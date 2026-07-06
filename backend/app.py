import os
import time
import io
from uuid import uuid4

from dotenv import load_dotenv
from groq import Groq
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt
from pydantic import BaseModel, Field
import requests
from sqlalchemy import create_engine, text
import pandas as pd

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
SUPABASE_PROJECT_URL = os.getenv("SUPABASE_PROJECT_URL")
JWKS_CACHE = {
    "keys": [],
    "expires_at": 0
}

engine = create_engine(DATABASE_URL)

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SetCreate(BaseModel):
    set_number: int = Field(ge=1, le=100)
    weight_lbs: float = Field(ge=1, le=1500)
    reps: int = Field(ge=1, le=500)


class ExerciseSetCreate(SetCreate):
    exercise: str


class WorkoutCreate(BaseModel):
    workout_date: str
    workout_type: str
    sets: list[ExerciseSetCreate]


class ExerciseBlockUpdate(BaseModel):
    exercise: str
    sets: list[SetCreate]


class WorkoutUpdate(BaseModel):
    workout_date: str
    workout_type: str
    exercises: list[ExerciseBlockUpdate]


class BodyMetricCreate(BaseModel):
    metric_date: str
    weight: float = Field(gt=0)
    weight_unit: str
    height_unit: str
    height_cm: float | None = Field(default=None, gt=0)
    height_feet: int | None = Field(default=None, ge=0)
    height_inches: float | None = Field(default=None, ge=0)


class BodyMetricUpdate(BodyMetricCreate):
    pass


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1200)


GUEST_EXERCISES = {
    "Bench Press",
    "Squat",
    "Deadlift",
    "Shoulder Press",
    "Seated Row"
}
USER_MAX_SETS_PER_EXERCISE = 100
GUEST_MAX_SETS_PER_EXERCISE = 4
GUEST_MAX_EXERCISES = 3
EXPORT_TABLES = {
    "workouts",
    "exercise_logs",
    "body_metrics"
}


def validate_set_counts_by_exercise(sets, max_sets, mode_name):

    counts = {}

    for exercise_set in sets:

        if exercise_set.set_number > max_sets:

            raise HTTPException(
                status_code=400,
                detail=f"{mode_name} set numbers must be between 1 and {max_sets}"
            )

        counts[exercise_set.exercise] = counts.get(exercise_set.exercise, 0) + 1

    over_limit = [
        exercise
        for exercise, count in counts.items()
        if count > max_sets
    ]

    if over_limit:

        raise HTTPException(
            status_code=400,
            detail=f"{mode_name} allows up to {max_sets} sets per exercise"
        )


def normalize_weight_kg(weight, unit):

    normalized_unit = unit.lower()

    if normalized_unit == "kg":
        return weight

    if normalized_unit == "lbs":
        return weight * 0.45359237

    raise HTTPException(
        status_code=400,
        detail="Weight unit must be lbs or kg"
    )


def normalize_height_cm(metric):

    normalized_unit = metric.height_unit.lower()

    if normalized_unit == "cm":

        if metric.height_cm is None:

            raise HTTPException(
                status_code=400,
                detail="Height in centimeters is required"
            )

        return metric.height_cm

    if normalized_unit == "ft_in":

        feet = metric.height_feet or 0
        inches = metric.height_inches or 0

        if inches <= 0:

            raise HTTPException(
                status_code=400,
                detail="Height inches must be greater than 0"
            )

        return ((feet * 12) + inches) * 2.54

    raise HTTPException(
        status_code=400,
        detail="Height unit must be cm or ft_in"
    )


def find_new_prs_for_workout(user_id, workout):

    incoming_prs = {}

    for exercise_set in workout.sets:

        incoming_prs[exercise_set.exercise] = max(
            incoming_prs.get(exercise_set.exercise, 0),
            exercise_set.weight_lbs
        )

    new_prs = []

    for exercise, current_pr in incoming_prs.items():

        previous_query = """
        SELECT MAX(e.weight_lbs) AS previous_pr
        FROM exercise_logs e
        JOIN workouts w
            ON e.workout_id = w.workout_id
        WHERE w.user_id = %(user_id)s
            AND e.exercise = %(exercise)s
            AND w.workout_date < %(workout_date)s
        """

        previous_df = pd.read_sql(
            previous_query,
            engine,
            params={
                "user_id": user_id,
                "exercise": exercise,
                "workout_date": workout.workout_date
            }
        )
        previous_pr = previous_df.iloc[0]["previous_pr"]

        if pd.notna(previous_pr) and current_pr > previous_pr:

            new_prs.append({
                "exercise": exercise,
                "current_pr": current_pr,
                "previous_pr": previous_pr,
                "improvement_lbs": current_pr - previous_pr
            })

    return new_prs


@app.on_event("startup")
def ensure_body_metrics_table():

    with engine.begin() as conn:

        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS body_metrics (
                    metric_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    metric_date DATE NOT NULL,
                    weight_kg DOUBLE PRECISION NOT NULL,
                    height_cm DOUBLE PRECISION NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )


def classify_muscle(exercise):

    if not exercise:
        return "Unknown"

    exercise = exercise.lower()

    if any(word in exercise for word in [
        "glute",
        "hip thrust",
        "kickback",
        "abduction"
    ]):
        return "Glutes"

    if any(word in exercise for word in [
        "quad",
        "leg press",
        "leg extension",
        "squat",
        "split squat",
        "lunge"
    ]):
        return "Quads"

    if any(word in exercise for word in [
        "shoulder",
        "lateral raise",
        "front raise",
        "rear delt"
    ]):
        return "Shoulders"

    if any(word in exercise for word in [
        "hamstring",
        "leg curl",
        "rdl",
        "romanian deadlift",
        "deadlift"
    ]):
        return "Hamstrings"

    if "calf" in exercise:
        return "Calves"

    if any(word in exercise for word in [
        "lat",
        "row",
        "pulldown",
        "pull-up",
        "pull up",
        "face pull"
    ]):
        return "Back"

    if any(word in exercise for word in [
        "chest",
        "bench",
        "pec",
        "fly",
        "pushups",
        "push-up"
    ]):
        return "Chest"

    if any(word in exercise for word in [
        "bicep",
        "curl",
        "hammer curl",
        "preacher curl"
    ]):
        return "Biceps"

    if any(word in exercise for word in [
        "tricep",
        "pushdown",
        "skull crusher",
        "overhead extension",
        "dip"
    ]):
        return "Triceps"

    if any(word in exercise for word in [
        "abs",
        "crunch",
        "plank",
        "core",
        "sit-up",
        "sit up"
    ]):
        return "Core"

    return "Other"


def get_supabase_jwks():

    if JWKS_CACHE["keys"] and JWKS_CACHE["expires_at"] > time.time():

        return JWKS_CACHE["keys"]

    response = requests.get(
        f"{SUPABASE_PROJECT_URL}/auth/v1/.well-known/jwks.json",
        timeout=10
    )
    response.raise_for_status()

    keys = response.json().get("keys", [])

    JWKS_CACHE["keys"] = keys
    JWKS_CACHE["expires_at"] = time.time() + 3600

    return keys


def decode_supabase_token(token):

    issuer = f"{SUPABASE_PROJECT_URL}/auth/v1"
    header = jwt.get_unverified_header(token)
    algorithm = header.get("alg")
    key_id = header.get("kid")

    if algorithm == "HS256" and SUPABASE_JWT_SECRET:

        return jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
            issuer=issuer
        )

    for jwk_key in get_supabase_jwks():

        if jwk_key.get("kid") != key_id:
            continue

        return jwt.decode(
            token,
            jwk_key,
            algorithms=[algorithm],
            audience="authenticated",
            issuer=issuer
        )

    raise JWTError("No matching Supabase signing key found")


def get_current_user_id(authorization: str = Header(None)):

    if not authorization or not authorization.startswith("Bearer "):

        raise HTTPException(
            status_code=401,
            detail="Missing auth token"
        )

    if not SUPABASE_PROJECT_URL:

        raise HTTPException(
            status_code=500,
            detail="SUPABASE_PROJECT_URL is missing"
        )

    token = authorization.replace("Bearer ", "")

    try:

        payload = decode_supabase_token(token)

        return payload["sub"]

    except JWTError:

        raise HTTPException(
            status_code=401,
            detail="Invalid auth token"
        )




@app.get("/")
def home():

    return {
        "message": "Workout Analytics API Running"
    }

@app.post("/workouts")
def create_workout(
    workout: WorkoutCreate,
    user_id: str = Depends(get_current_user_id)
):

    if not workout.sets:

        raise HTTPException(
            status_code=400,
            detail="Workout must include at least one set"
        )

    validate_set_counts_by_exercise(
        workout.sets,
        USER_MAX_SETS_PER_EXERCISE,
        "User mode"
    )
    new_prs = find_new_prs_for_workout(user_id, workout)

    workout_id = f"{workout.workout_date}_{workout.workout_type}_{uuid4().hex[:8]}"

    workout_row = pd.DataFrame([
        {
            "workout_id": workout_id,
            "workout_date": workout.workout_date,
            "workout_type": workout.workout_type,
            "user_id": user_id
        }
    ])

    exercise_rows = []

    for exercise_set in workout.sets:

        volume = exercise_set.weight_lbs * exercise_set.reps

        exercise_rows.append({
            "workout_id": workout_id,
            "exercise": exercise_set.exercise,
            "set_number": exercise_set.set_number,
            "weight_lbs": exercise_set.weight_lbs,
            "reps": exercise_set.reps,
            "volume": volume,
            "muscle_group": classify_muscle(exercise_set.exercise)
        })

    exercise_logs_df = pd.DataFrame(exercise_rows)

    with engine.begin() as conn:

        workout_row.to_sql(
            "workouts",
            conn,
            if_exists="append",
            index=False
        )

        exercise_logs_df.to_sql(
            "exercise_logs",
            conn,
            if_exists="append",
            index=False
        )

    return {
        "workout_id": workout_id,
        "sets_added": len(exercise_rows),
        "new_prs": new_prs
    }

@app.post("/guest-ai-insights")
def guest_ai_insights(workout: WorkoutCreate):

    if not workout.sets:

        raise HTTPException(
            status_code=400,
            detail="Workout must include at least one set"
        )

    exercise_names = {exercise_set.exercise for exercise_set in workout.sets}

    if len(exercise_names) > GUEST_MAX_EXERCISES:

        raise HTTPException(
            status_code=400,
            detail="Guest mode allows up to 3 exercises"
        )

    invalid_exercises = sorted(exercise_names - GUEST_EXERCISES)

    if invalid_exercises:

        raise HTTPException(
            status_code=400,
            detail="Guest mode can only use the predefined demo exercises"
        )

    validate_set_counts_by_exercise(
        workout.sets,
        GUEST_MAX_SETS_PER_EXERCISE,
        "Guest mode"
    )

    exercise_rows = []

    for exercise_set in workout.sets:

        volume = exercise_set.weight_lbs * exercise_set.reps

        exercise_rows.append({
            "exercise": exercise_set.exercise,
            "set_number": exercise_set.set_number,
            "weight_lbs": exercise_set.weight_lbs,
            "reps": exercise_set.reps,
            "volume": volume,
            "muscle_group": classify_muscle(exercise_set.exercise)
        })

    guest_df = pd.DataFrame(exercise_rows)

    muscle_df = (
        guest_df
        .groupby("muscle_group", as_index=False)
        .agg(
            total_volume=("volume", "sum"),
            total_sets=("set_number", "count")
        )
        .sort_values("total_volume", ascending=False)
    )

    exercise_df = (
        guest_df
        .groupby("exercise", as_index=False)
        .agg(
            total_volume=("volume", "sum"),
            total_sets=("set_number", "count")
        )
        .sort_values("total_sets", ascending=False)
    )

    prompt = f"""
You are an elite fitness analytics coach.

Analyze this temporary guest workout and generate concise insights.

Workout date:
{workout.workout_date}

Workout type:
{workout.workout_type}

Muscle group summary:
{muscle_df.to_string(index=False)}

Exercise summary:
{exercise_df.to_string(index=False)}

Rules:
- Use these exact section titles: Strengths, Potential Issues, Recommendations
- Maximum 2 bullet points per section
- One sentence per bullet
- No introductions
- No conclusions
- Keep the tone concise and analytical
"""

    completion = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    return {
        "insight": completion.choices[0].message.content
    }

@app.get("/workouts/range")
def workouts_by_range(
    from_date: str = Query(...),
    to_date: str = Query(...),
    user_id: str = Depends(get_current_user_id)
):

    if from_date > to_date:

        raise HTTPException(
            status_code=400,
            detail="from_date must be before or equal to to_date"
        )

    query = """
    SELECT
        workout_id,
        workout_date,
        workout_type
    FROM workouts
    WHERE user_id = %(user_id)s
        AND workout_date BETWEEN %(from_date)s AND %(to_date)s
    ORDER BY workout_date DESC, workout_type
    """

    df = pd.read_sql(
        query,
        engine,
        params={
            "user_id": user_id,
            "from_date": from_date,
            "to_date": to_date
        }
    )

    return df.to_dict(orient="records")

@app.get("/workouts/{workout_id}")
def workout_detail(
    workout_id: str,
    user_id: str = Depends(get_current_user_id)
):

    workout_query = """
    SELECT
        workout_id,
        workout_date,
        workout_type
    FROM workouts
    WHERE workout_id = %(workout_id)s
        AND user_id = %(user_id)s
    """

    workout_df = pd.read_sql(
        workout_query,
        engine,
        params={
            "workout_id": workout_id,
            "user_id": user_id
        }
    )

    if workout_df.empty:

        raise HTTPException(
            status_code=404,
            detail="Workout not found"
        )

    logs_query = """
    SELECT
        exercise,
        set_number,
        weight_lbs,
        reps,
        volume,
        muscle_group
    FROM exercise_logs
    WHERE workout_id = %(workout_id)s
    ORDER BY exercise, set_number
    """

    logs_df = pd.read_sql(
        logs_query,
        engine,
        params={"workout_id": workout_id}
    )

    exercises = []

    for exercise_name, group in logs_df.groupby("exercise", sort=False):

        exercises.append({
            "exercise": exercise_name,
            "sets": group[
                [
                    "set_number",
                    "weight_lbs",
                    "reps",
                    "volume",
                    "muscle_group"
                ]
            ].to_dict(orient="records")
        })

    workout = workout_df.iloc[0].to_dict()
    workout["exercises"] = exercises

    total_volume = float(logs_df["volume"].sum()) if not logs_df.empty else 0
    workout["total_volume"] = total_volume

    if logs_df.empty or total_volume == 0:

        workout["muscle_distribution"] = []

    else:

        muscle_df = (
            logs_df
            .groupby("muscle_group", as_index=False)
            .agg(total_volume=("volume", "sum"))
            .sort_values("total_volume", ascending=False)
        )
        muscle_df["percentage"] = (
            muscle_df["total_volume"]
            / total_volume
            * 100
        )
        workout["muscle_distribution"] = muscle_df.to_dict(orient="records")

    return workout

@app.put("/workouts/{workout_id}")
def update_workout(
    workout_id: str,
    workout: WorkoutUpdate,
    user_id: str = Depends(get_current_user_id)
):

    existing_query = """
    SELECT workout_id
    FROM workouts
    WHERE workout_id = %(workout_id)s
        AND user_id = %(user_id)s
    """

    existing_df = pd.read_sql(
        existing_query,
        engine,
        params={
            "workout_id": workout_id,
            "user_id": user_id
        }
    )

    if existing_df.empty:

        raise HTTPException(
            status_code=404,
            detail="Workout not found"
        )

    exercise_rows = []

    for exercise_block in workout.exercises:

        if len(exercise_block.sets) > USER_MAX_SETS_PER_EXERCISE:

            raise HTTPException(
                status_code=400,
                detail="User mode allows up to 100 sets per exercise"
            )

        for exercise_set in exercise_block.sets:

            volume = exercise_set.weight_lbs * exercise_set.reps

            exercise_rows.append({
                "workout_id": workout_id,
                "exercise": exercise_block.exercise,
                "set_number": exercise_set.set_number,
                "weight_lbs": exercise_set.weight_lbs,
                "reps": exercise_set.reps,
                "volume": volume,
                "muscle_group": classify_muscle(exercise_block.exercise)
            })

    if not exercise_rows:

        raise HTTPException(
            status_code=400,
            detail="Workout must include at least one set"
        )

    exercise_logs_df = pd.DataFrame(exercise_rows)

    with engine.begin() as conn:

        conn.execute(
            text(
                """
                UPDATE workouts
                SET workout_date = :workout_date,
                    workout_type = :workout_type
                WHERE workout_id = :workout_id
                    AND user_id = :user_id
                """
            ),
            {
                "workout_date": workout.workout_date,
                "workout_type": workout.workout_type,
                "workout_id": workout_id,
                "user_id": user_id
            }
        )

        conn.execute(
            text(
                """
                DELETE FROM exercise_logs
                WHERE workout_id = :workout_id
                """
            ),
            {"workout_id": workout_id}
        )

        exercise_logs_df.to_sql(
            "exercise_logs",
            conn,
            if_exists="append",
            index=False
        )

    return {
        "workout_id": workout_id,
        "sets_saved": len(exercise_rows)
    }

@app.delete("/workouts/{workout_id}")
def delete_workout(
    workout_id: str,
    user_id: str = Depends(get_current_user_id)
):

    existing_query = """
    SELECT workout_id
    FROM workouts
    WHERE workout_id = %(workout_id)s
        AND user_id = %(user_id)s
    """

    existing_df = pd.read_sql(
        existing_query,
        engine,
        params={
            "workout_id": workout_id,
            "user_id": user_id
        }
    )

    if existing_df.empty:

        raise HTTPException(
            status_code=404,
            detail="Workout not found"
        )

    with engine.begin() as conn:

        conn.execute(
            text(
                """
                DELETE FROM exercise_logs
                WHERE workout_id = :workout_id
                """
            ),
            {"workout_id": workout_id}
        )

        conn.execute(
            text(
                """
                DELETE FROM workouts
                WHERE workout_id = :workout_id
                    AND user_id = :user_id
                """
            ),
            {
                "workout_id": workout_id,
                "user_id": user_id
            }
        )

    return {
        "workout_id": workout_id,
        "deleted": True
    }

@app.get("/muscle-groups")
def muscle_groups(user_id: str = Depends(get_current_user_id)):

    query = """
    SELECT
        e.muscle_group,
        SUM(e.volume) AS total_volume,
        COUNT(*) AS total_sets
    FROM exercise_logs e
    JOIN workouts w
        ON e.workout_id = w.workout_id
    WHERE w.user_id = %(user_id)s
    GROUP BY e.muscle_group
    ORDER BY total_volume DESC
    """

    return pd.read_sql(
        query,
        engine,
        params={"user_id": user_id}
    ).to_dict(
        orient="records"
    )
@app.get("/workouts")
def workouts(user_id: str = Depends(get_current_user_id)):

    query = """
    SELECT *
    FROM workouts
    WHERE user_id = %(user_id)s
    ORDER BY workout_date DESC
    LIMIT 10
    """

    df = pd.read_sql(
        query,
        engine,
        params={"user_id": user_id}
    )

    return df.to_dict(orient="records")

@app.get("/exercise/{exercise_name}")
def exercise_progression(
    exercise_name: str,
    user_id: str = Depends(get_current_user_id)
):

    query = """
    SELECT
        TO_CHAR(
        w.workout_date,
        'YYYY-MM-DD'
        ) AS workout_date,
        MAX(e.weight_lbs) AS max_weight
    FROM exercise_logs e
    JOIN workouts w
        ON e.workout_id = w.workout_id
    WHERE e.exercise = %(exercise)s
        AND w.user_id = %(user_id)s
    GROUP BY w.workout_date
    ORDER BY w.workout_date
    """

    df = pd.read_sql(
        query,
        engine,
        params={
            "exercise": exercise_name,
            "user_id": user_id
        }
    )

    if not df.empty:

        pr_weight = df["max_weight"].max()
        df["is_pr"] = False
        first_pr_index = df.index[df["max_weight"] == pr_weight][0]
        df.loc[first_pr_index, "is_pr"] = True

    return df.to_dict(orient="records")


@app.get("/achievements")
def achievements(user_id: str = Depends(get_current_user_id)):

    query = """
    WITH today_prs AS (
        SELECT
            e.exercise,
            MAX(e.weight_lbs) AS today_pr
        FROM exercise_logs e
        JOIN workouts w
            ON e.workout_id = w.workout_id
        WHERE w.user_id = %(user_id)s
            AND w.workout_date = CURRENT_DATE
        GROUP BY e.exercise
    ),
    previous_prs AS (
        SELECT
            e.exercise,
            MAX(e.weight_lbs) AS previous_pr
        FROM exercise_logs e
        JOIN workouts w
            ON e.workout_id = w.workout_id
        WHERE w.user_id = %(user_id)s
            AND w.workout_date < CURRENT_DATE
        GROUP BY e.exercise
    )
    SELECT
        today_prs.exercise,
        today_prs.today_pr AS current_pr,
        previous_prs.previous_pr,
        today_prs.today_pr - previous_prs.previous_pr AS improvement_lbs
    FROM today_prs
    JOIN previous_prs
        ON today_prs.exercise = previous_prs.exercise
    WHERE today_prs.today_pr > previous_prs.previous_pr
    ORDER BY improvement_lbs DESC, today_prs.exercise
    """

    df = pd.read_sql(
        query,
        engine,
        params={"user_id": user_id}
    )

    return df.to_dict(orient="records")


@app.post("/body-metrics")
def create_body_metric(
    metric: BodyMetricCreate,
    user_id: str = Depends(get_current_user_id)
):

    metric_id = uuid4().hex
    weight_kg = normalize_weight_kg(metric.weight, metric.weight_unit)
    height_cm = normalize_height_cm(metric)

    metric_row = pd.DataFrame([
        {
            "metric_id": metric_id,
            "user_id": user_id,
            "metric_date": metric.metric_date,
            "weight_kg": weight_kg,
            "height_cm": height_cm
        }
    ])

    with engine.begin() as conn:

        metric_row.to_sql(
            "body_metrics",
            conn,
            if_exists="append",
            index=False
        )

    return {
        "metric_id": metric_id,
        "metric_date": metric.metric_date,
        "weight_kg": weight_kg,
        "height_cm": height_cm
    }


@app.get("/body-metrics")
def body_metrics(
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    user_id: str = Depends(get_current_user_id)
):

    query = """
    SELECT
        metric_id,
        metric_date,
        weight_kg,
        height_cm,
        created_at
    FROM body_metrics
    WHERE user_id = %(user_id)s
        AND (%(from_date)s IS NULL OR metric_date >= %(from_date)s)
        AND (%(to_date)s IS NULL OR metric_date <= %(to_date)s)
    ORDER BY metric_date DESC, created_at DESC
    """

    df = pd.read_sql(
        query,
        engine,
        params={
            "user_id": user_id,
            "from_date": from_date,
            "to_date": to_date
        }
    )

    return df.to_dict(orient="records")


@app.put("/body-metrics/{metric_id}")
def update_body_metric(
    metric_id: str,
    metric: BodyMetricUpdate,
    user_id: str = Depends(get_current_user_id)
):

    weight_kg = normalize_weight_kg(metric.weight, metric.weight_unit)
    height_cm = normalize_height_cm(metric)

    with engine.begin() as conn:

        result = conn.execute(
            text(
                """
                UPDATE body_metrics
                SET metric_date = :metric_date,
                    weight_kg = :weight_kg,
                    height_cm = :height_cm
                WHERE metric_id = :metric_id
                    AND user_id = :user_id
                """
            ),
            {
                "metric_id": metric_id,
                "user_id": user_id,
                "metric_date": metric.metric_date,
                "weight_kg": weight_kg,
                "height_cm": height_cm
            }
        )

    if result.rowcount == 0:

        raise HTTPException(
            status_code=404,
            detail="Body metric not found"
        )

    return {
        "metric_id": metric_id,
        "metric_date": metric.metric_date,
        "weight_kg": weight_kg,
        "height_cm": height_cm
    }


@app.delete("/body-metrics/{metric_id}")
def delete_body_metric(
    metric_id: str,
    user_id: str = Depends(get_current_user_id)
):

    with engine.begin() as conn:

        result = conn.execute(
            text(
                """
                DELETE FROM body_metrics
                WHERE metric_id = :metric_id
                    AND user_id = :user_id
                """
            ),
            {
                "metric_id": metric_id,
                "user_id": user_id
            }
        )

    if result.rowcount == 0:

        raise HTTPException(
            status_code=404,
            detail="Body metric not found"
        )

    return {
        "metric_id": metric_id,
        "deleted": True
    }


@app.get("/weight-progression")
def weight_progression(user_id: str = Depends(get_current_user_id)):

    query = """
    SELECT
        metric_date,
        weight_kg,
        weight_kg / 0.45359237 AS weight_lbs
    FROM body_metrics
    WHERE user_id = %(user_id)s
    ORDER BY metric_date
    """

    df = pd.read_sql(
        query,
        engine,
        params={"user_id": user_id}
    )

    if df.empty:

        return {
            "records": [],
            "current_weight_kg": None,
            "current_weight_lbs": None,
            "monthly_change_kg": None,
            "monthly_change_lbs": None,
            "trend": "flat"
        }

    current = df.iloc[-1]
    current_date = pd.to_datetime(current["metric_date"])
    month_start = current_date - pd.DateOffset(months=1)
    month_df = df[pd.to_datetime(df["metric_date"]) >= month_start]
    baseline = month_df.iloc[0] if not month_df.empty else df.iloc[0]
    monthly_change_kg = current["weight_kg"] - baseline["weight_kg"]
    monthly_change_lbs = current["weight_lbs"] - baseline["weight_lbs"]

    return {
        "records": df.to_dict(orient="records"),
        "current_weight_kg": float(current["weight_kg"]),
        "current_weight_lbs": float(current["weight_lbs"]),
        "monthly_change_kg": float(monthly_change_kg),
        "monthly_change_lbs": float(monthly_change_lbs),
        "trend": "up" if monthly_change_kg > 0 else "down" if monthly_change_kg < 0 else "flat"
    }


@app.get("/export/{table_name}")
def export_table(
    table_name: str,
    file_format: str = Query("csv", pattern="^(csv|xlsx)$"),
    user_id: str = Depends(get_current_user_id)
):

    if table_name not in EXPORT_TABLES:

        raise HTTPException(
            status_code=400,
            detail="Unsupported export table"
        )

    if table_name == "exercise_logs":

        query = """
        SELECT
            e.workout_id,
            w.workout_date,
            w.workout_type,
            e.exercise,
            e.set_number,
            e.weight_lbs,
            e.reps,
            e.volume,
            e.muscle_group
        FROM exercise_logs e
        JOIN workouts w
            ON e.workout_id = w.workout_id
        WHERE w.user_id = %(user_id)s
        ORDER BY w.workout_date DESC, e.exercise, e.set_number
        """

    elif table_name == "workouts":

        query = """
        SELECT
            workout_id,
            workout_date,
            workout_type,
            user_id
        FROM workouts
        WHERE user_id = %(user_id)s
        ORDER BY workout_date DESC
        """

    else:

        query = """
        SELECT
            metric_id,
            metric_date,
            weight_kg,
            height_cm,
            created_at
        FROM body_metrics
        WHERE user_id = %(user_id)s
        ORDER BY metric_date DESC, created_at DESC
        """

    df = pd.read_sql(
        query,
        engine,
        params={"user_id": user_id}
    )

    if file_format == "csv":

        buffer = io.StringIO()
        df.to_csv(buffer, index=False)
        buffer.seek(0)

        return StreamingResponse(
            iter([buffer.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={table_name}.csv"
            }
        )

    buffer = io.BytesIO()

    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:

        df.to_excel(writer, index=False, sheet_name=table_name[:31])

    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={table_name}.xlsx"
        }
    )


@app.post("/ai-chat")
def ai_chat(
    chat: ChatRequest,
    user_id: str = Depends(get_current_user_id)
):

    summary_query = """
    SELECT
        COUNT(DISTINCT w.workout_id) AS total_workouts,
        COALESCE(SUM(e.volume), 0) AS total_volume,
        COUNT(e.*) AS total_sets
    FROM workouts w
    LEFT JOIN exercise_logs e
        ON w.workout_id = e.workout_id
    WHERE w.user_id = %(user_id)s
    """
    muscles_query = """
    SELECT
        e.muscle_group,
        SUM(e.volume) AS total_volume,
        COUNT(*) AS total_sets
    FROM exercise_logs e
    JOIN workouts w
        ON e.workout_id = w.workout_id
    WHERE w.user_id = %(user_id)s
    GROUP BY e.muscle_group
    ORDER BY total_volume DESC
    LIMIT 8
    """
    recent_query = """
    SELECT
        workout_date,
        workout_type
    FROM workouts
    WHERE user_id = %(user_id)s
    ORDER BY workout_date DESC
    LIMIT 5
    """

    params = {"user_id": user_id}
    summary_df = pd.read_sql(summary_query, engine, params=params)
    muscles_df = pd.read_sql(muscles_query, engine, params=params)
    recent_df = pd.read_sql(recent_query, engine, params=params)

    prompt = f"""
You are a concise fitness analytics assistant inside a workout tracker.
Answer the user's question using the available training summary when relevant.
Do not invent exact values that are not in the data.

User question:
{chat.message}

Dashboard summary:
{summary_df.to_string(index=False)}

Muscle distribution:
{muscles_df.to_string(index=False)}

Recent workouts:
{recent_df.to_string(index=False)}
"""

    completion = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    return {
        "answer": completion.choices[0].message.content
    }


@app.get("/dashboard")
def dashboard(user_id: str = Depends(get_current_user_id)):

    query = """
    SELECT
        COUNT(DISTINCT w.workout_id) AS total_workouts,
        COALESCE(SUM(e.volume), 0) AS total_volume,
        COUNT(e.*) AS total_sets
    FROM workouts w
    LEFT JOIN exercise_logs e
        ON w.workout_id = e.workout_id
    WHERE w.user_id = %(user_id)s
    """

    df = pd.read_sql(
        query,
        engine,
        params={"user_id": user_id}
    )

    return df.to_dict(orient="records")

@app.get("/top-exercises")
def top_exercises(user_id: str = Depends(get_current_user_id)):

    query = """
    SELECT
        e.exercise,
        COUNT(*) AS total_sets,
        SUM(e.volume) AS total_volume
    FROM exercise_logs e
    JOIN workouts w
        ON e.workout_id = w.workout_id
    WHERE w.user_id = %(user_id)s
    GROUP BY e.exercise
    ORDER BY total_sets DESC
    LIMIT 10
    """

    df = pd.read_sql(
        query,
        engine,
        params={"user_id": user_id}
    )

    return df.to_dict(orient="records")



@app.get("/weekly-volume")
def weekly_volume(user_id: str = Depends(get_current_user_id)):

    query = """
    SELECT
        TO_CHAR(
    DATE_TRUNC('week', w.workout_date),
    'YYYY-MM-DD'
) AS week,
        SUM(e.volume) AS total_volume
    FROM workouts w
    JOIN exercise_logs e
        ON w.workout_id = e.workout_id
    WHERE w.user_id = %(user_id)s
    GROUP BY week
    ORDER BY week
    """

    df = pd.read_sql(
        query,
        engine,
        params={"user_id": user_id}
    )

    return df.to_dict(orient="records")

@app.get("/exercise-list")
def exercise_list(user_id: str = Depends(get_current_user_id)):

    query = """
    SELECT DISTINCT e.exercise
    FROM exercise_logs e
    JOIN workouts w
        ON e.workout_id = w.workout_id
    WHERE w.user_id = %(user_id)s
    ORDER BY e.exercise
    """

    df = pd.read_sql(
        query,
        engine,
        params={"user_id": user_id}
    )

    return df.to_dict(orient="records")

@app.get("/ai-insights")
def ai_insights(user_id: str = Depends(get_current_user_id)):

    # =========================================
    # WEEKLY TREND SUMMARY
    # =========================================

    weekly_query = """

    SELECT
        DATE_TRUNC('week', w.workout_date) AS week,
        SUM(e.volume) AS total_volume,
        COUNT(*) AS total_sets

    FROM exercise_logs e

    JOIN workouts w
        ON e.workout_id = w.workout_id

    WHERE w.user_id = %(user_id)s

    GROUP BY week

    ORDER BY week DESC

    LIMIT 2

    """

    weekly_df = pd.read_sql(
        weekly_query,
        engine,
        params={"user_id": user_id}
    )

    if len(weekly_df) < 2:

        return {
            "insight": "Not enough workout history yet."
        }

    current_week = weekly_df.iloc[0]
    previous_week = weekly_df.iloc[1]

    volume_change = (
        (
            current_week["total_volume"]
            - previous_week["total_volume"]
        )
        / previous_week["total_volume"]
    ) * 100

    sets_change = (
        (
            current_week["total_sets"]
            - previous_week["total_sets"]
        )
        / previous_week["total_sets"]
    ) * 100

    # =========================================
    # MUSCLE GROUP ANALYSIS
    # =========================================

    muscle_query = """

    SELECT
        muscle_group,
        SUM(volume) AS total_volume,
        COUNT(*) AS total_sets

    FROM exercise_logs e

    JOIN workouts w
        ON e.workout_id = w.workout_id

    WHERE DATE_TRUNC('week', w.workout_date)
        = (
            SELECT MAX(
                DATE_TRUNC('week', workout_date)
            )
            FROM workouts
            WHERE user_id = %(user_id)s
        )
        AND w.user_id = %(user_id)s

    GROUP BY muscle_group

    ORDER BY total_volume DESC

    """

    muscle_df = pd.read_sql(
        muscle_query,
        engine,
        params={"user_id": user_id}
    )

    # =========================================
    # EXERCISE ANALYSIS
    # =========================================

    exercise_query = """

    SELECT
        exercise,
        COUNT(*) AS total_sets,
        SUM(volume) AS total_volume

    FROM exercise_logs e

    JOIN workouts w
        ON e.workout_id = w.workout_id

    WHERE DATE_TRUNC('week', w.workout_date)
        = (
            SELECT MAX(
                DATE_TRUNC('week', workout_date)
            )
            FROM workouts
            WHERE user_id = %(user_id)s
        )
        AND w.user_id = %(user_id)s

    GROUP BY exercise

    ORDER BY total_sets DESC

    LIMIT 10

    """

    exercise_df = pd.read_sql(
        exercise_query,
        engine,
        params={"user_id": user_id}
    )

    # =========================================
    # AI PROMPT
    # =========================================

    prompt = f"""
    
You are an elite fitness analytics coach.

Analyze the workout data and generate:

1. 2 key strengths
2. 2 potential problems
3. 2 actionable recommendations

Focus on:
- overtrained muscles
- undertrained muscles
- excessive exercise volume
- muscular imbalance
- recovery concerns

Keep the tone sharp and concise.

Rules:
- Maximum 8 bullet points total
- No long explanations
- No introductions
- No conclusions
- Each bullet should be one sentence only
- Be specific with muscle groups and exercises

WEEKLY TREND SUMMARY

Current week volume:
{current_week["total_volume"]}

Previous week volume:
{previous_week["total_volume"]}

Volume change:
{volume_change:.1f}%

Current week total sets:
{current_week["total_sets"]}

Previous week total sets:
{previous_week["total_sets"]}

Sets change:
{sets_change:.1f}%

MUSCLE GROUP SUMMARY

{muscle_df.to_string(index=False)}

TOP EXERCISES

{exercise_df.to_string(index=False)}
    
    """

    # =========================================
    # GROQ API CALL
    # =========================================

    completion = client.chat.completions.create(

        model="llama-3.1-8b-instant",

        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]

    )

    insight = (
        completion
        .choices[0]
        .message
        .content
    )

    # =========================================
    # RETURN RESPONSE
    # =========================================

    return {
        "insight": insight
    }
