import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";

import { useEffect, useMemo, useState } from "react";
import { hasSupabaseConfig, supabase } from "./supabaseClient";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://workout-analytics-system.onrender.com";

const demoDashboard = {
  total_workouts: 128,
  total_sets: 1840,
  total_volume: 624500,
};

const demoMuscles = [
  { muscle_group: "Glutes", total_volume: 168400 },
  { muscle_group: "Quads", total_volume: 104800 },
  { muscle_group: "Back", total_volume: 82200 },
  { muscle_group: "Chest", total_volume: 68400 },
  { muscle_group: "Hamstrings", total_volume: 51200 },
  { muscle_group: "Shoulders", total_volume: 44800 },
];

const demoWeeklyVolume = [
  { week: "W1", total_volume: 31500 },
  { week: "W2", total_volume: 38200 },
  { week: "W3", total_volume: 35600 },
  { week: "W4", total_volume: 44200 },
  { week: "W5", total_volume: 47100 },
  { week: "W6", total_volume: 52800 },
];

const demoWeightProgression = {
  records: [
    { metric_date: "2026-05-01", weight_kg: 61.2, weight_lbs: 135 },
    { metric_date: "2026-05-08", weight_kg: 60.8, weight_lbs: 134 },
    { metric_date: "2026-05-15", weight_kg: 60.3, weight_lbs: 133 },
    { metric_date: "2026-05-22", weight_kg: 59.9, weight_lbs: 132 },
  ],
  current_weight_kg: 59.9,
  current_weight_lbs: 132,
  monthly_change_kg: -1.3,
  monthly_change_lbs: -3,
  trend: "down",
};

const demoAchievements = [
  { exercise: "Bench Press", improvement_lbs: 10, current_pr: 205, previous_pr: 195 },
  { exercise: "Hip Thrust", improvement_lbs: 20, current_pr: 275, previous_pr: 255 },
];

const demoWorkouts = [
  { workout_id: 1, workout_date: "2026-05-03", workout_type: "Push Strength" },
  { workout_id: 2, workout_date: "2026-05-06", workout_type: "Lower Power" },
  { workout_id: 3, workout_date: "2026-05-09", workout_type: "Pull Hypertrophy" },
  { workout_id: 4, workout_date: "2026-05-12", workout_type: "Full Body" },
  { workout_id: 5, workout_date: "2026-05-15", workout_type: "Conditioning" },
];

const demoExercises = [
  { exercise: "Bench Press" },
  { exercise: "Squat" },
  { exercise: "Deadlift" },
  { exercise: "Shoulder Press" },
  { exercise: "Seated Row" },
  { exercise: "Hip Thrust" },
  { exercise: "Romanian Deadlift" },
  { exercise: "Leg Press" },
];

const guestExerciseOptions = demoExercises.slice(0, 5);

const exerciseMuscleMap = {
  "Bench Press": "Chest",
  Squat: "Quads",
  Deadlift: "Hamstrings",
  "Shoulder Press": "Shoulders",
  "Seated Row": "Back",
};

const REP_LIMITS = {
  min: 1,
  max: 500,
};

const WEIGHT_LIMITS = {
  min: 1,
  max: 1500,
};

const SET_LIMITS = {
  guest: 4,
  user: 100,
};

const GUEST_EXERCISE_LIMIT = 3;

const demoWorkoutDetails = [
  {
    workout_id: 1,
    workout_date: "2026-05-03",
    workout_type: "Push Strength",
    exercises: [
      {
        exercise: "Bench Press",
        sets: [
          { set_number: 1, weight_lbs: 185, reps: 6 },
          { set_number: 2, weight_lbs: 185, reps: 6 },
          { set_number: 3, weight_lbs: 195, reps: 4 },
        ],
      },
      {
        exercise: "Shoulder Press",
        sets: [
          { set_number: 1, weight_lbs: 95, reps: 8 },
          { set_number: 2, weight_lbs: 95, reps: 8 },
        ],
      },
    ],
  },
  {
    workout_id: 2,
    workout_date: "2026-05-06",
    workout_type: "Lower Power",
    exercises: [
      {
        exercise: "Squat",
        sets: [
          { set_number: 1, weight_lbs: 225, reps: 5 },
          { set_number: 2, weight_lbs: 235, reps: 5 },
          { set_number: 3, weight_lbs: 245, reps: 3 },
        ],
      },
      {
        exercise: "Romanian Deadlift",
        sets: [
          { set_number: 1, weight_lbs: 185, reps: 8 },
          { set_number: 2, weight_lbs: 185, reps: 8 },
        ],
      },
    ],
  },
  {
    workout_id: 3,
    workout_date: "2026-05-09",
    workout_type: "Pull Hypertrophy",
    exercises: [
      {
        exercise: "Seated Row",
        sets: [
          { set_number: 1, weight_lbs: 140, reps: 10 },
          { set_number: 2, weight_lbs: 150, reps: 10 },
          { set_number: 3, weight_lbs: 150, reps: 9 },
        ],
      },
      {
        exercise: "Deadlift",
        sets: [
          { set_number: 1, weight_lbs: 275, reps: 4 },
          { set_number: 2, weight_lbs: 275, reps: 4 },
        ],
      },
    ],
  },
  {
    workout_id: 4,
    workout_date: "2026-05-12",
    workout_type: "Full Body",
    exercises: [
      {
        exercise: "Leg Press",
        sets: [
          { set_number: 1, weight_lbs: 360, reps: 10 },
          { set_number: 2, weight_lbs: 380, reps: 8 },
        ],
      },
      {
        exercise: "Bench Press",
        sets: [
          { set_number: 1, weight_lbs: 175, reps: 8 },
          { set_number: 2, weight_lbs: 185, reps: 6 },
        ],
      },
    ],
  },
  {
    workout_id: 5,
    workout_date: "2026-05-15",
    workout_type: "Conditioning",
    exercises: [
      {
        exercise: "Hip Thrust",
        sets: [
          { set_number: 1, weight_lbs: 225, reps: 10 },
          { set_number: 2, weight_lbs: 245, reps: 10 },
          { set_number: 3, weight_lbs: 255, reps: 8 },
        ],
      },
    ],
  },
];

const demoExerciseData = [
  { workout_date: "May 01", max_weight: 185 },
  { workout_date: "May 08", max_weight: 195 },
  { workout_date: "May 15", max_weight: 205 },
  { workout_date: "May 22", max_weight: 215 },
];

const demoInsight =
  "Strengths\n" +
  "Lower-body volume is consistent and gives the sample athlete a strong training base.\n" +
  "Weekly volume is trending upward without a sharp spike in total sets.\n\n" +
  "Potential Issues\n" +
  "Hamstrings trail glute and quad volume, which may create a lower-body imbalance over time.\n" +
  "Chest and shoulder volume are lower than the main lower-body muscle groups.\n\n" +
  "Recommendations\n" +
  "Add one direct hamstring movement and one upper-body press variation this week.\n" +
  "Keep weekly volume increases gradual so progression does not outrun recovery.";

const emptyDraft = {
  workoutDate: "",
  workoutType: "",
  exercises: [],
};

const emptySet = {
  set_number: "1",
  weight_lbs: "",
  reps: "",
};

function authFetch(path, session, options = {}) {
  if (!session?.access_token) {
    throw new Error("You must be signed in before loading private workout data.");
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(options.headers || {}),
    },
  });
}

function normalizeDateInput(value) {
  if (!value) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const slashDate = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!slashDate) {
    return value;
  }

  const [, month, day, year] = slashDate;

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function formatDateOnly(value) {
  if (!value) return "";

  return String(value).split("T")[0].split(" ")[0];
}

function normalizeWorkoutDates(workout) {
  return {
    ...workout,
    workout_date: formatDateOnly(workout.workout_date),
  };
}

function chartTooltipStyle() {
  return {
    background: "#050505",
    border: "1px solid rgba(255,255,255,.14)",
    borderRadius: "12px",
    color: "#f8fafc",
  };
}

function formatWeightLbs(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";

  return `${Math.round(Number(value)).toLocaleString()} lbs`;
}

function formatWeightChange(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "No weight trend yet";

  const roundedValue = Math.round(Number(value));

  if (roundedValue === 0) return "No change this month";

  return `${roundedValue > 0 ? "Up" : "Down"} ${Math.abs(roundedValue).toLocaleString()} lbs this month`;
}

function buildSingleMetricProgression(metric) {
  if (!metric) return demoWeightProgression;

  const weightKg = Number(metric.weight_kg);
  const weightLbs = weightKg / 0.45359237;

  return {
    records: [
      {
        metric_date: metric.metric_date,
        weight_kg: weightKg,
        weight_lbs: weightLbs,
      },
    ],
    current_weight_kg: weightKg,
    current_weight_lbs: weightLbs,
    monthly_change_kg: 0,
    monthly_change_lbs: 0,
    trend: "flat",
  };
}

function markFirstPrPoint(records) {
  if (!records.length) return records;

  const maxWeight = Math.max(...records.map((record) => Number(record.max_weight)));
  let prMarked = false;

  return records.map((record) => {
    const isFirstPr = !prMarked && Number(record.max_weight) === maxWeight;
    if (isFirstPr) prMarked = true;

    return {
      ...record,
      is_pr: isFirstPr,
    };
  });
}

function PrDot({ cx, cy, payload }) {
  if (!payload?.is_pr) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill="#38f8ff"
      />
    );
  }

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={8}
        fill="#d7ff3f"
      />
      <text
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        fontSize="10"
      >
        🏆
      </text>
    </g>
  );
}

function draftKey(session) {
  return `workout-draft-${session?.user?.id || "anonymous"}`;
}

function loadDraft(session) {
  try {
    return JSON.parse(localStorage.getItem(draftKey(session))) || null;
  } catch {
    return null;
  }
}

function saveDraft(session, draft) {
  localStorage.setItem(draftKey(session), JSON.stringify(draft));
}

function clearDraft(session) {
  localStorage.removeItem(draftKey(session));
}

function flattenDraftSets(draft) {
  return draft.exercises.flatMap((exerciseBlock) =>
    exerciseBlock.sets.map((set) => ({
      exercise: exerciseBlock.exercise,
      set_number: Number(set.set_number),
      weight_lbs: Number(set.weight_lbs),
      reps: Number(set.reps),
    })),
  );
}

function isWithinLimits(value, limits) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue >= limits.min && numberValue <= limits.max;
}

function validateSets(setRows, maxSets) {
  if (setRows.length > maxSets) {
    return `Each exercise can include up to ${maxSets} sets.`;
  }

  const invalidSetNumber = setRows.some((setRow) => {
    const setNumber = Number(setRow.set_number);

    return !Number.isInteger(setNumber) || setNumber < 1 || setNumber > maxSets;
  });

  if (invalidSetNumber) {
    return `Set numbers must be between 1 and ${maxSets}.`;
  }

  if (setRows.some((setRow) => !isWithinLimits(setRow.weight_lbs, WEIGHT_LIMITS))) {
    return "Weight must be between 1 and 1,500 pounds.";
  }

  if (setRows.some((setRow) => !isWithinLimits(setRow.reps, REP_LIMITS))) {
    return "Reps must be between 1 and 500.";
  }

  return "";
}

function validateDraftLimits(draft, maxSets) {
  for (const exerciseBlock of draft.exercises) {
    const error = validateSets(exerciseBlock.sets, maxSets);

    if (error) return error;
  }

  return "";
}

function classifyGuestExercise(exercise) {
  return exerciseMuscleMap[exercise] || "Other";
}

function buildGuestDashboardData(savedWorkout) {
  if (!savedWorkout) {
    return {
      dashboard: demoDashboard,
      muscles: demoMuscles,
      weeklyVolume: demoWeeklyVolume,
      workouts: demoWorkouts,
      exerciseList: demoExercises,
      exerciseData: demoExerciseData,
      achievements: [],
      insight: demoInsight,
    };
  }

  const flattenedSets = flattenDraftSets(savedWorkout);
  const addedVolume = flattenedSets.reduce(
    (total, set) => total + set.weight_lbs * set.reps,
    0,
  );
  const muscleTotals = flattenedSets.reduce((totals, set) => {
    const muscleGroup = classifyGuestExercise(set.exercise);
    totals[muscleGroup] = (totals[muscleGroup] || 0) + set.weight_lbs * set.reps;
    return totals;
  }, {});
  const exerciseNames = [...new Set(flattenedSets.map((set) => set.exercise))];

  return {
    dashboard: {
      total_workouts: demoDashboard.total_workouts + 1,
      total_sets: demoDashboard.total_sets + flattenedSets.length,
      total_volume: demoDashboard.total_volume + addedVolume,
    },
    muscles: demoMuscles.map((muscle) => ({
      ...muscle,
      total_volume: muscle.total_volume + (muscleTotals[muscle.muscle_group] || 0),
    })),
    weeklyVolume: demoWeeklyVolume.map((week, index) =>
      index === demoWeeklyVolume.length - 1
        ? {
            ...week,
            total_volume: week.total_volume + addedVolume,
          }
        : week,
    ),
    workouts: [
      {
        workout_id: "guest-temporary-workout",
        workout_date: savedWorkout.workoutDate,
        workout_type: savedWorkout.workoutType,
      },
      ...demoWorkouts,
    ],
    exerciseList: [
      ...exerciseNames.map((exercise) => ({ exercise })),
      ...demoExercises.filter((exercise) => !exerciseNames.includes(exercise.exercise)),
    ],
    exerciseData: demoExerciseData,
    achievements: demoAchievements,
    insight: savedWorkout.insight || demoInsight,
  };
}

function buildGuestExerciseData(savedWorkout, selectedExercise) {
  if (!savedWorkout || !selectedExercise) return markFirstPrPoint(demoExerciseData);

  const exerciseBlock = savedWorkout.exercises.find(
    (block) => block.exercise === selectedExercise,
  );

  if (!exerciseBlock) return markFirstPrPoint(demoExerciseData);

  const maxWeight = Math.max(...exerciseBlock.sets.map((set) => Number(set.weight_lbs)));

  return markFirstPrPoint([
    ...demoExerciseData,
    {
      workout_date: formatDateOnly(savedWorkout.workoutDate),
      max_weight: maxWeight,
    },
  ]);
}

function formatInsightLine(line) {
  return line.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    return part;
  });
}

function InsightText({ text }) {
  if (!text) return null;

  return (
    <div className="insight-copy">
      {text.split("\n").map((line, index) => {
        const trimmedLine = line.trim();

        if (!trimmedLine) return null;

        if (trimmedLine.startsWith("* ") || trimmedLine.startsWith("- ")) {
          return (
            <p key={index} className="insight-bullet">
              {formatInsightLine(trimmedLine.slice(2))}
            </p>
          );
        }

        return <p key={index}>{formatInsightLine(trimmedLine)}</p>;
      })}
    </div>
  );
}

function LandingScreen({ onGuest, onSignIn }) {
  return (
    <main className="entry-shell">
      <section className="entry-panel">
        <div>
          <span className="eyebrow">Workout Intelligence</span>
          <h1>Train smarter with an AI-powered analytics dashboard.</h1>
          <p>
            Continue as guest for sample AI analytics, or sign in to log and
            edit workouts.
          </p>
        </div>

        <div className="entry-actions">
          <button className="primary-action" type="button" onClick={onSignIn}>
            Sign in
          </button>
          <button className="secondary-action" type="button" onClick={onGuest}>
            Continue as guest
          </button>
        </div>
      </section>
    </main>
  );
}

function AuthScreen({ onBack, onAuthSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  async function submitAuth(event) {
    event.preventDefault();
    setAuthMessage("");

    if (!hasSupabaseConfig) {
      setAuthMessage("Supabase env vars are missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }

    setAuthLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthLoading(false);

    if (error) {
      setAuthMessage(error.message);
      return;
    }

    if (data.session) {
      onAuthSuccess(data.session);
      return;
    }

    setAuthMessage("Sign in did not return a session. Please try again.");
  }

  return (
    <main className="entry-shell">
      <section className="auth-panel">
        <button className="ghost-action back-action" type="button" onClick={onBack}>
          Back
        </button>

        <span className="eyebrow">Owner Mode</span>
        <h1>Sign in to your training space.</h1>
        <p>Use your private owner account to unlock workout logging and editing.</p>

        <form className="auth-form" onSubmit={submitAuth}>
          <label>
            Email
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
            />
          </label>
          {authMessage && <div className="auth-message">{authMessage}</div>}
          <button className="primary-action" type="submit" disabled={authLoading}>
            {authLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({
  mode,
  session,
  onReset,
  onSignOut,
  onAddWorkout,
  onPreviousWorkouts,
  onBodyMetrics,
  onResumeWorkout,
  guestSavedWorkout,
  guestBodyMetric,
}) {
  const isGuest = mode === "guest";
  const guestData = useMemo(() => buildGuestDashboardData(guestSavedWorkout), [guestSavedWorkout]);
  const [dashboard, setDashboard] = useState(isGuest ? guestData.dashboard : null);
  const [muscles, setMuscles] = useState(isGuest ? guestData.muscles : []);
  const [weeklyVolume, setWeeklyVolume] = useState(isGuest ? guestData.weeklyVolume : []);
  const [exerciseList, setExerciseList] = useState(isGuest ? guestData.exerciseList : []);
  const [selectedExercise, setSelectedExercise] = useState(isGuest ? guestData.exerciseList[0].exercise : "");
  const [exerciseData, setExerciseData] = useState(isGuest ? guestData.exerciseData : []);
  const [achievements, setAchievements] = useState(isGuest ? guestData.achievements : []);
  const [weightProgression, setWeightProgression] = useState(isGuest ? demoWeightProgression : null);
  const [aiInsight, setAiInsight] = useState(isGuest ? guestData.insight : "");
  const [insightLoading, setInsightLoading] = useState(!isGuest);
  const [apiOffline, setApiOffline] = useState(false);
  const draft = !isGuest && session ? loadDraft(session) : null;
  const displayDashboard = isGuest ? guestData.dashboard : dashboard;
  const displayMuscles = isGuest ? guestData.muscles : muscles;
  const displayWeeklyVolume = isGuest ? guestData.weeklyVolume : weeklyVolume;
  const displayExerciseList = isGuest ? guestData.exerciseList : exerciseList;
  const displayExerciseData = isGuest
    ? buildGuestExerciseData(guestSavedWorkout, selectedExercise)
    : markFirstPrPoint(exerciseData);
  const displayAchievements = isGuest ? guestData.achievements : achievements;
  const displayWeightProgression = isGuest ? buildSingleMetricProgression(guestBodyMetric) : weightProgression;
  const displayAiInsight = isGuest ? guestData.insight : aiInsight;

  useEffect(() => {
    if (isGuest || !session) return;

    authFetch("/dashboard", session)
      .then((res) => res.json())
      .then((data) => setDashboard(data[0] || demoDashboard))
      .catch((err) => {
        console.error(err);
        setApiOffline(true);
        setDashboard(demoDashboard);
      });
  }, [isGuest, session]);

  useEffect(() => {
    if (isGuest || !session) return;

    authFetch("/achievements", session)
      .then((res) => res.json())
      .then((data) => setAchievements(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error(err);
        setAchievements([]);
      });
  }, [isGuest, session]);

  useEffect(() => {
    if (isGuest || !session) return;

    authFetch("/weight-progression", session)
      .then((res) => res.json())
      .then((data) => setWeightProgression(data))
      .catch((err) => {
        console.error(err);
        setWeightProgression(null);
      });
  }, [isGuest, session]);

  useEffect(() => {
    if (isGuest || !session) return;

    authFetch("/muscle-groups", session)
      .then((res) => res.json())
      .then((data) => setMuscles(data.length ? data : demoMuscles))
      .catch((err) => {
        console.error(err);
        setMuscles(demoMuscles);
      });
  }, [isGuest, session]);

  useEffect(() => {
    if (isGuest || !session) return;

    authFetch("/weekly-volume", session)
      .then((res) => res.json())
      .then((data) => setWeeklyVolume(data.length ? data : demoWeeklyVolume))
      .catch((err) => {
        console.error("Weekly volume error:", err);
        setWeeklyVolume(demoWeeklyVolume);
      });
  }, [isGuest, session]);

  useEffect(() => {
    if (isGuest || !session) return;

    authFetch("/exercise-list", session)
      .then((res) => res.json())
      .then((data) => {
        const exercises = data.length ? data : demoExercises;
        setExerciseList(exercises);

        if (exercises.length > 0) setSelectedExercise(exercises[0].exercise);
      })
      .catch((err) => {
        console.error(err);
        setExerciseList(demoExercises);
        setSelectedExercise(demoExercises[0].exercise);
      });
  }, [isGuest, session]);

  useEffect(() => {
    if (isGuest || !session || !selectedExercise) return;

    authFetch(`/exercise/${encodeURIComponent(selectedExercise)}`, session)
      .then((res) => res.json())
      .then((data) => setExerciseData(data.length ? data : demoExerciseData))
      .catch((err) => {
        console.error(err);
        setExerciseData(demoExerciseData);
      });
  }, [isGuest, selectedExercise, session]);

  useEffect(() => {
    if (isGuest || !session) return;

    authFetch("/ai-insights", session)
      .then((res) => res.json())
      .then((data) => {
        setAiInsight(data.insight || demoInsight);
        setInsightLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setAiInsight(demoInsight);
        setInsightLoading(false);
      });
  }, [isGuest, session]);

  if (!displayDashboard) {
    return (
      <main className="app-shell loading-shell">
        <div className="loading-card">
          <div className="pulse-ring" />
          <h2>Loading dashboard...</h2>
          <p>Warming up your training analytics</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <nav className="app-nav">
        <div>
          <span className="nav-mark">WA</span>
          <span>{isGuest ? "Guest Demo" : "Owner Dashboard"}</span>
        </div>
        <div className="nav-actions">
          {!isGuest && session?.user?.email && <span className="user-email">{session.user.email}</span>}
          <button
            className="secondary-action"
            disabled={isGuest && Boolean(guestSavedWorkout)}
            title={isGuest && guestSavedWorkout ? "Guest mode allows one temporary workout." : undefined}
            type="button"
            onClick={onAddWorkout}
          >
            Add Workout
          </button>
          <button className="secondary-action" type="button" onClick={onPreviousWorkouts}>
            See Previous Workouts
          </button>
          <button className="secondary-action" type="button" onClick={onBodyMetrics}>
            Body Metrics
          </button>
          {!isGuest && (
            <button className="ghost-action" type="button" onClick={onSignOut}>
              Sign out
            </button>
          )}
          <button className="ghost-action" type="button" onClick={onReset}>
            Switch mode
          </button>
        </div>
      </nav>

      {draft && !isGuest && (
        <section className="progress-banner">
          <div>
            <span className="eyebrow">Workout in progress</span>
            <p>
              {draft.workoutType || "Untitled workout"} on {draft.workoutDate || "unscheduled date"} has{" "}
              {draft.exercises.length} saved exercise block{draft.exercises.length === 1 ? "" : "s"}.
            </p>
          </div>
          <button className="primary-action" type="button" onClick={onResumeWorkout}>
            Resume
          </button>
        </section>
      )}

      <section className="dashboard-hero">
        <div>
          <span className="eyebrow">Performance Command Center</span>
          <h1>Workout Analytics Dashboard</h1>
          <p>
            {isGuest
              ? "Browse AI-generated sample analytics without exposing personal training data."
              : "Track volume, consistency, and strength progress with your personal training data."}
          </p>
          {apiOffline && (
            <div className="offline-pill">
              Live user data is temporarily unavailable, so sample data is showing.
            </div>
          )}
        </div>

        <div className="hero-stat">
          <span>Training Volume</span>
          <strong>{displayDashboard.total_volume.toLocaleString()}</strong>
          <small>{isGuest ? "sample load" : "lifetime load"}</small>
        </div>
      </section>

      <section className="kpi-grid">
        <div className="metric-card workouts">
          <span className="metric-icon">W</span>
          <p>Total Workouts</p>
          <h2>{displayDashboard.total_workouts.toLocaleString()}</h2>
          <small>completed sessions</small>
        </div>

        <div className="metric-card sets">
          <span className="metric-icon">S</span>
          <p>Total Sets</p>
          <h2>{displayDashboard.total_sets.toLocaleString()}</h2>
          <small>tracked efforts</small>
        </div>

        <div className="metric-card volume">
          <span className="metric-icon">V</span>
          <p>Total Volume</p>
          <h2>{displayDashboard.total_volume.toLocaleString()}</h2>
          <small>total load moved</small>
        </div>

        <div className="metric-card weight">
          <span className="metric-icon">B</span>
          <p>Current Weight</p>
          <h2>{formatWeightLbs(displayWeightProgression?.current_weight_lbs)}</h2>
          <small>{formatWeightChange(displayWeightProgression?.monthly_change_lbs)}</small>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="panel chart-panel">
          <div className="panel-header">
            <div>
              <span>Muscle Focus</span>
              <h3>Volume by Muscle Group</h3>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={[...displayMuscles].sort((a, b) => b.total_volume - a.total_volume)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" vertical={false} />
              <XAxis dataKey="muscle_group" tick={{ fill: "#9aa4b2", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#9aa4b2", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => value.toLocaleString()} contentStyle={chartTooltipStyle()} />
              <Bar dataKey="total_volume" fill="#d7ff3f" radius={[8, 8, 2, 2]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel">
          <div className="panel-header">
            <div>
              <span>Trendline</span>
              <h3>Weekly Training Volume</h3>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={displayWeeklyVolume}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" vertical={false} />
              <XAxis dataKey="week" tick={{ fill: "#9aa4b2", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#9aa4b2", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => value.toLocaleString()} contentStyle={chartTooltipStyle()} />
              <Line
                type="monotone"
                dataKey="total_volume"
                stroke="#d7ff3f"
                strokeWidth={4}
                dot={{ r: 4, fill: "#d7ff3f", strokeWidth: 0 }}
                activeDot={{ r: 7, fill: "#050505", stroke: "#d7ff3f", strokeWidth: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="lower-grid">
        <div className="panel weight-panel">
          <div className="panel-header">
            <div>
              <span>Body Metrics</span>
              <h3>Weight Progression</h3>
            </div>
          </div>

          <div className="progression-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayWeightProgression?.records || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" vertical={false} />
                <XAxis dataKey="metric_date" tick={{ fill: "#9aa4b2", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#9aa4b2", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => formatWeightLbs(value)} contentStyle={chartTooltipStyle()} />
                <Line
                  type="monotone"
                  dataKey="weight_lbs"
                  stroke="#d7ff3f"
                  strokeWidth={4}
                  dot={{ r: 4, fill: "#d7ff3f", strokeWidth: 0 }}
                  activeDot={{ r: 7, fill: "#050505", stroke: "#d7ff3f", strokeWidth: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel progression-panel">
          <div className="panel-header">
            <div>
              <span>Strength Curve</span>
              <h3>Exercise Progression</h3>
            </div>
          </div>

          <select
            className="exercise-select"
            value={selectedExercise}
            onChange={(event) => setSelectedExercise(event.target.value)}
          >
            {displayExerciseList.map((exercise, index) => (
              <option key={index} value={exercise.exercise}>
                {exercise.exercise}
              </option>
            ))}
          </select>

          <div className="progression-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayExerciseData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" vertical={false} />
                <XAxis dataKey="workout_date" tick={{ fill: "#9aa4b2", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#9aa4b2", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTooltipStyle()} />
                <Line
                  type="monotone"
                  dataKey="max_weight"
                  stroke="#38f8ff"
                  strokeWidth={4}
                  dot={<PrDot />}
                  activeDot={{ r: 7, fill: "#050505", stroke: "#38f8ff", strokeWidth: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="panel achievements-panel">
        <div className="panel-header">
          <div>
            <span>Progress Wins</span>
            <h3>Today's Achievements</h3>
          </div>
        </div>

        {displayAchievements.length > 0 ? (
          <div className="achievement-list">
            {displayAchievements.map((achievement) => (
              <div className="achievement-item" key={achievement.exercise}>
                🏆 New PR: {achievement.exercise} (+{Math.round(achievement.improvement_lbs)} lbs)
              </div>
            ))}
          </div>
        ) : (
          <p className="achievement-empty">
            You're still showing up for yourself. That's a worthy achievement. Keep going.
          </p>
        )}
      </section>

      <section className="panel insights-panel">
        <div className="panel-header">
          <div>
            <span>AI Coach</span>
            <h3>Insights</h3>
          </div>
        </div>

        {insightLoading ? (
          <div className="insight-loading">Analyzing training patterns...</div>
        ) : (
          <InsightText text={displayAiInsight} />
        )}
      </section>
    </main>
  );
}

function WorkoutSetupPage({ isGuest, session, guestDraft, setGuestDraft, onBack, onContinue }) {
  const existingDraft = useMemo(
    () => (isGuest ? guestDraft : loadDraft(session)),
    [guestDraft, isGuest, session],
  );
  const [workoutDate, setWorkoutDate] = useState(existingDraft?.workoutDate || "");
  const [workoutType, setWorkoutType] = useState(existingDraft?.workoutType || "");

  if (!isGuest && !session) {
    return <SignedOutNotice onBack={onBack} />;
  }

  function continueWorkout(event) {
    event.preventDefault();
    const nextDraft = {
      ...(existingDraft || emptyDraft),
      workoutDate,
      workoutType,
    };

    if (isGuest) {
      setGuestDraft(nextDraft);
    } else {
      saveDraft(session, nextDraft);
    }
    onContinue();
  }

  return (
    <main className="app-shell narrow-shell">
      <section className="panel flow-panel">
        <button className="ghost-action back-action" type="button" onClick={onBack}>
          Back to dashboard
        </button>
        <span className="eyebrow">New Workout</span>
        <h1>Start a workout session.</h1>
        <p>
          Date and workout type stay locked for this session until you save the workout.
          {isGuest && " Guest progress is temporary and disappears when you exit this flow."}
        </p>

        <form className="auth-form" onSubmit={continueWorkout}>
          <label>
            Workout Date
            <input
              type="date"
              value={workoutDate}
              onChange={(event) => setWorkoutDate(event.target.value)}
              required
            />
          </label>
          <label>
            Workout Type
            <input
              type="text"
              placeholder="Push, Pull, Legs..."
              value={workoutType}
              onChange={(event) => setWorkoutType(event.target.value)}
              required
            />
          </label>
          <button className="primary-action" type="submit">
            Continue
          </button>
        </form>
      </section>
    </main>
  );
}

function ExerciseEntryPage({
  isGuest,
  session,
  guestDraft,
  setGuestDraft,
  exerciseOptions,
  onBack,
  onWorkoutSaved,
  onGuestWorkoutSaved,
}) {
  const [draft, setDraft] = useState(() => (isGuest ? guestDraft : loadDraft(session)) || emptyDraft);
  const [exercise, setExercise] = useState("");
  const [sets, setSets] = useState([{ ...emptySet }]);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState(exerciseOptions);

  useEffect(() => {
    if (isGuest || !session) return;

    authFetch("/exercise-list", session)
      .then((res) => res.json())
      .then((data) => setSuggestions(data.length ? data : exerciseOptions))
      .catch((err) => {
        console.error(err);
        setSuggestions(exerciseOptions);
      });
  }, [exerciseOptions, isGuest, session]);

  if (!isGuest && !session) {
    return <SignedOutNotice onBack={onBack} />;
  }

  function persistDraft(nextDraft) {
    setDraft(nextDraft);
    if (isGuest) {
      setGuestDraft(nextDraft);
    } else {
      saveDraft(session, nextDraft);
    }
  }

  function updateSet(index, field, value) {
    setSets((currentSets) =>
      currentSets.map((setRow, rowIndex) =>
        rowIndex === index
          ? {
              ...setRow,
              [field]: value,
            }
          : setRow,
      ),
    );
  }

  function addSet() {
    const maxSets = isGuest ? SET_LIMITS.guest : SET_LIMITS.user;

    if (sets.length >= maxSets) {
      setStatus(
        isGuest
          ? "Guest mode allows up to 4 sets per exercise. Sign in to save more."
          : "Each exercise can include up to 100 sets.",
      );
      return;
    }

    setSets((currentSets) => [
      ...currentSets,
      {
        ...emptySet,
        set_number: String(currentSets.length + 1),
      },
    ]);
  }

  function removeSet(index) {
    setSets((currentSets) => currentSets.filter((_setRow, rowIndex) => rowIndex !== index));
  }

  function saveExercise(event) {
    event.preventDefault();

    const maxSets = isGuest ? SET_LIMITS.guest : SET_LIMITS.user;
    const setError = validateSets(sets, maxSets);

    if (setError) {
      setStatus(setError);
      return;
    }

    if (isGuest && !guestExerciseOptions.some((option) => option.exercise === exercise)) {
      setStatus("Choose one of the guest exercise options.");
      return;
    }

    if (isGuest && draft.exercises.some((exerciseBlock) => exerciseBlock.exercise === exercise)) {
      setStatus("That exercise is already in this guest workout.");
      return;
    }

    if (isGuest && draft.exercises.length >= GUEST_EXERCISE_LIMIT) {
      setStatus("Guest mode allows up to 3 exercises. Sign in to save your full workout.");
      return;
    }

    const exerciseBlock = {
      exercise,
      sets: sets.map((setRow) => ({
        set_number: Number(setRow.set_number),
        weight_lbs: Number(setRow.weight_lbs),
        reps: Number(setRow.reps),
      })),
    };

    const nextDraft = {
      ...draft,
      exercises: [...draft.exercises, exerciseBlock],
    };

    persistDraft(nextDraft);
    setExercise("");
    setSets([{ ...emptySet }]);
    setStatus(
      isGuest
        ? "Exercise saved to this temporary workout."
        : "Exercise saved to this workout session.",
    );
  }

  async function saveWorkout() {
    if (isGuest) {
      if (!draft.workoutDate || !draft.workoutType || draft.exercises.length === 0) {
        setStatus("Add at least one saved exercise before saving the temporary workout.");
        return;
      }

      const draftError = validateDraftLimits(draft, SET_LIMITS.guest);

      if (draftError) {
        setStatus(draftError);
        return;
      }

      setSaving(true);
      setStatus("Analyzing temporary workout...");

      try {
        const response = await fetch(`${API_BASE}/guest-ai-insights`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            workout_date: draft.workoutDate,
            workout_type: draft.workoutType,
            sets: flattenDraftSets(draft),
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Could not analyze guest workout.");
        }

        onGuestWorkoutSaved({
          ...draft,
          insight: data.insight,
        });
        setGuestDraft(emptyDraft);
        setStatus("Temporary workout added to the guest dashboard.");
        onWorkoutSaved();
      } catch (error) {
        setStatus(error.message);
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!draft.workoutDate || !draft.workoutType || draft.exercises.length === 0) {
      setStatus("Add at least one saved exercise before saving the workout.");
      return;
    }

    const draftError = validateDraftLimits(draft, SET_LIMITS.user);

    if (draftError) {
      setStatus(draftError);
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      const response = await authFetch("/workouts", session, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workout_date: draft.workoutDate,
          workout_type: draft.workoutType,
          sets: flattenDraftSets(draft),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Could not save workout");
      }

      clearDraft(session);
      setStatus("Workout saved.");
      onWorkoutSaved();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="panel flow-panel">
        <button className="ghost-action back-action" type="button" onClick={onBack}>
          Back to dashboard
        </button>
        <span className="eyebrow">Workout in progress</span>
        <h1>{draft.workoutType || "Workout Session"}</h1>
        <p>{draft.workoutDate || "No date selected yet"}</p>

        {draft.exercises.length > 0 && (
          <div className="saved-exercise-list">
            {draft.exercises.map((exerciseBlock, index) => (
              <div className="saved-exercise-chip" key={`${exerciseBlock.exercise}-${index}`}>
                {exerciseBlock.exercise} · {exerciseBlock.sets.length} set{exerciseBlock.sets.length === 1 ? "" : "s"}
              </div>
            ))}
          </div>
        )}

        <form className="exercise-entry" onSubmit={saveExercise}>
          <label>
            Exercise
            {isGuest ? (
              <select
                className="exercise-select"
                value={exercise}
                onChange={(event) => setExercise(event.target.value)}
                required
              >
                <option value="">Select an exercise</option>
                {guestExerciseOptions.map((option) => (
                  <option key={option.exercise} value={option.exercise}>
                    {option.exercise}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input
                  list="exercise-options"
                  type="text"
                  placeholder="Hip Thrust"
                  value={exercise}
                  onChange={(event) => setExercise(event.target.value)}
                  required
                />
                <datalist id="exercise-options">
                  {suggestions.map((option) => (
                    <option key={option.exercise} value={option.exercise} />
                  ))}
                </datalist>
              </>
            )}
          </label>

          <div className="set-log">
            {sets.map((setRow, index) => (
              <div className="set-row" key={index}>
                <label>
                  Set
                  <input
                    type="number"
                    min="1"
                    max={isGuest ? SET_LIMITS.guest : SET_LIMITS.user}
                    value={setRow.set_number}
                    onChange={(event) => updateSet(index, "set_number", event.target.value)}
                    required
                  />
                </label>
                <label>
                  Weight (lbs)
                  <input
                    type="number"
                    step="0.1"
                    min={WEIGHT_LIMITS.min}
                    max={WEIGHT_LIMITS.max}
                    value={setRow.weight_lbs}
                    onChange={(event) => updateSet(index, "weight_lbs", event.target.value)}
                    required
                  />
                </label>
                <label>
                  Reps
                  <input
                    type="number"
                    min={REP_LIMITS.min}
                    max={REP_LIMITS.max}
                    value={setRow.reps}
                    onChange={(event) => updateSet(index, "reps", event.target.value)}
                    required
                  />
                </label>
                <button
                  className="ghost-action remove-set"
                  disabled={sets.length === 1}
                  type="button"
                  onClick={() => removeSet(index)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {status && <div className="auth-message">{status}</div>}

          <div className="logger-actions">
            <button className="secondary-action" type="button" onClick={addSet}>
              Add set
            </button>
            <button className="secondary-action" type="submit">
              Save Exercise
            </button>
            <button className="primary-action" disabled={saving} type="button" onClick={saveWorkout}>
              {saving ? "Saving..." : "Save Workout"}
            </button>
          </div>
          {isGuest && (
            <p className="temporary-note">
              Your workout will only stay here for this visit. Sign in to keep it with your dashboard.
            </p>
          )}
        </form>
      </section>
    </main>
  );
}

function BodyMetricsPage({ isGuest, session, guestBodyMetric, setGuestBodyMetric, onBack }) {
  const [metricDate, setMetricDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState("lbs");
  const [heightUnit, setHeightUnit] = useState("ft_in");
  const [heightCm, setHeightCm] = useState("");
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [metrics, setMetrics] = useState(() => (guestBodyMetric ? [guestBodyMetric] : []));
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isGuest || !session) return;

    authFetch("/body-metrics", session)
      .then((res) => res.json())
      .then((data) => setMetrics(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error(err);
        setStatus("Could not load body metrics.");
      });
  }, [isGuest, session]);

  if (!isGuest && !session) {
    return <SignedOutNotice onBack={onBack} />;
  }

  function buildLocalMetric() {
    const weightKg = weightUnit === "kg" ? Number(weight) : Number(weight) * 0.45359237;
    const normalizedHeightCm =
      heightUnit === "cm"
        ? Number(heightCm)
        : ((Number(heightFeet) || 0) * 12 + (Number(heightInches) || 0)) * 2.54;

    return {
      metric_id: "guest-body-metric",
      metric_date: metricDate,
      weight_kg: weightKg,
      height_cm: normalizedHeightCm,
    };
  }

  async function saveMetric(event) {
    event.preventDefault();

    if (isGuest) {
      if (metrics.length >= 1) {
        setStatus("Guest mode allows one temporary body metric entry.");
        return;
      }

      const nextMetric = buildLocalMetric();
      setGuestBodyMetric(nextMetric);
      setMetrics([nextMetric]);
      setStatus("Temporary body metric saved for this visit.");
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      const response = await authFetch("/body-metrics", session, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metric_date: metricDate,
          weight: Number(weight),
          weight_unit: weightUnit,
          height_unit: heightUnit,
          height_cm: heightUnit === "cm" ? Number(heightCm) : null,
          height_feet: heightUnit === "ft_in" ? Number(heightFeet) : null,
          height_inches: heightUnit === "ft_in" ? Number(heightInches) : null,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not save body metrics.");
      }

      setMetrics((currentMetrics) => [data, ...currentMetrics]);
      setStatus("Body metrics saved.");
      setWeight("");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="panel flow-panel">
        <button className="ghost-action back-action" type="button" onClick={onBack}>
          Back to dashboard
        </button>
        <span className="eyebrow">Body Metrics</span>
        <h1>Log body metrics.</h1>
        <p>
          {isGuest
            ? "Guest metrics stay in this visit only and disappear after refresh."
            : "Weight and height are converted before storage so your progress stays consistent."}
        </p>

        <form className="body-metrics-form" onSubmit={saveMetric}>
          <label>
            Date
            <input type="date" value={metricDate} onChange={(event) => setMetricDate(event.target.value)} required />
          </label>
          <label>
            Weight
            <input
              min="1"
              step="0.1"
              type="number"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              required
            />
          </label>
          <label>
            Weight Unit
            <select value={weightUnit} onChange={(event) => setWeightUnit(event.target.value)}>
              <option value="lbs">lbs</option>
              <option value="kg">kg</option>
            </select>
          </label>
          <label>
            Height Unit
            <select value={heightUnit} onChange={(event) => setHeightUnit(event.target.value)}>
              <option value="ft_in">feet/inches</option>
              <option value="cm">cm</option>
            </select>
          </label>
          {heightUnit === "cm" ? (
            <label>
              Height
              <input
                min="1"
                step="0.1"
                type="number"
                value={heightCm}
                onChange={(event) => setHeightCm(event.target.value)}
                required
              />
            </label>
          ) : (
            <>
              <label>
                Feet
                <input
                  min="0"
                  type="number"
                  value={heightFeet}
                  onChange={(event) => setHeightFeet(event.target.value)}
                  required
                />
              </label>
              <label>
                Inches
                <input
                  min="1"
                  type="number"
                  value={heightInches}
                  onChange={(event) => setHeightInches(event.target.value)}
                  required
                />
              </label>
            </>
          )}
          <button className="primary-action logger-submit" disabled={saving} type="submit">
            {saving ? "Saving..." : "Save Metrics"}
          </button>
        </form>

        {status && <div className="auth-message">{status}</div>}
      </section>

      {metrics.length > 0 && (
        <section className="panel history-detail">
          <div className="panel-header">
            <div>
              <span>Recent Entries</span>
              <h3>Body Metrics</h3>
            </div>
          </div>
          <div className="workout-table-wrap">
            <table className="workout-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Weight</th>
                  <th>Height</th>
                </tr>
              </thead>
              <tbody>
                {metrics.slice(0, 8).map((metric) => (
                  <tr key={metric.metric_id}>
                    <td>{formatDateOnly(metric.metric_date)}</td>
                    <td>{formatWeightLbs(Number(metric.weight_kg) / 0.45359237)}</td>
                    <td>{Number(metric.height_cm).toFixed(1)} cm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

function PreviousWorkoutsPage({ isGuest, session, onBack, onSignIn }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [workouts, setWorkouts] = useState(
    isGuest ? demoWorkouts.slice(0, 5).map(normalizeWorkoutDates) : [],
  );
  const [selectedWorkoutId, setSelectedWorkoutId] = useState("");
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (isGuest || !session) return;

    authFetch("/workouts", session)
      .then((res) => res.json())
      .then((data) => {
        const recentWorkouts = Array.isArray(data)
          ? data.slice(0, 5).map(normalizeWorkoutDates)
          : [];
        setWorkouts(recentWorkouts);
      })
      .catch((err) => {
        console.error(err);
        setStatus("Could not load recent workouts.");
      });
  }, [isGuest, session]);

  async function searchWorkouts(event) {
    event.preventDefault();
    setStatus("");
    setSelectedWorkout(null);
    setSelectedWorkoutId("");

    const normalizedFromDate = normalizeDateInput(fromDate);
    const normalizedToDate = normalizeDateInput(toDate);

    if (normalizedFromDate > normalizedToDate) {
      setStatus("From date must be before or equal to To date.");
      return;
    }

    if (isGuest) {
      const filteredWorkouts = demoWorkouts.filter(
        (workout) =>
          workout.workout_date >= normalizedFromDate &&
          workout.workout_date <= normalizedToDate,
      );
      setWorkouts(filteredWorkouts.map(normalizeWorkoutDates));
      setStatus(filteredWorkouts.length ? "" : "No sample workouts found in that range.");
      return;
    }

    if (!session) {
      setStatus("Please sign in before loading previous workouts.");
      return;
    }

    try {
      const response = await authFetch(
        `/workouts/range?from_date=${encodeURIComponent(normalizedFromDate)}&to_date=${encodeURIComponent(normalizedToDate)}`,
        session,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not load previous workouts.");
      }

      setWorkouts(Array.isArray(data) ? data.map(normalizeWorkoutDates) : []);
    } catch (error) {
      setStatus(error.message);
    }
  }

  useEffect(() => {
    if (!selectedWorkoutId || isGuest) return;

    if (!session) return;

    authFetch(`/workouts/${encodeURIComponent(selectedWorkoutId)}`, session)
      .then((res) => res.json())
      .then((data) => {
        setSelectedWorkout(normalizeWorkoutDates(data));
        setEditing(false);
      })
      .catch((err) => {
        console.error(err);
        setStatus("Could not load workout details.");
      });
  }, [isGuest, selectedWorkoutId, session]);

  if (!isGuest && !session) {
    return <SignedOutNotice onBack={onBack} />;
  }

  function updateWorkoutField(field, value) {
    setSelectedWorkout((currentWorkout) => ({
      ...currentWorkout,
      [field]: value,
    }));
  }

  function updateWorkoutSet(exerciseIndex, setIndex, field, value) {
    setSelectedWorkout((currentWorkout) => ({
      ...currentWorkout,
      exercises: currentWorkout.exercises.map((exerciseBlock, currentExerciseIndex) =>
        currentExerciseIndex === exerciseIndex
          ? {
              ...exerciseBlock,
              sets: exerciseBlock.sets.map((setRow, currentSetIndex) =>
                currentSetIndex === setIndex
                  ? {
                      ...setRow,
                      [field]: value,
                    }
                  : setRow,
              ),
            }
          : exerciseBlock,
      ),
    }));
  }

  function getEditedWorkoutError(workout) {
    if (!workout?.exercises?.length) return "Workout must include at least one exercise.";

    for (const exerciseBlock of workout.exercises) {
      const error = validateSets(exerciseBlock.sets, SET_LIMITS.user);

      if (error) return error;
    }

    return "";
  }

  function updateExerciseName(exerciseIndex, value) {
    setSelectedWorkout((currentWorkout) => ({
      ...currentWorkout,
      exercises: currentWorkout.exercises.map((exerciseBlock, currentExerciseIndex) =>
        currentExerciseIndex === exerciseIndex
          ? {
              ...exerciseBlock,
              exercise: value,
            }
          : exerciseBlock,
      ),
    }));
  }

  async function saveEditedWorkout() {
    if (isGuest) {
      setStatus("Sign in to edit workouts.");
      return;
    }

    setStatus("");

    const workoutError = getEditedWorkoutError(selectedWorkout);

    if (workoutError) {
      setStatus(workoutError);
      return;
    }

    const response = await authFetch(`/workouts/${encodeURIComponent(selectedWorkout.workout_id)}`, session, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workout_date: selectedWorkout.workout_date,
        workout_type: selectedWorkout.workout_type,
        exercises: selectedWorkout.exercises,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      setStatus(error.detail || "Could not save workout.");
      return;
    }

    setEditing(false);
    setStatus("Workout saved.");
  }

  async function deleteSelectedWorkout() {
    if (!selectedWorkout) return;

    if (isGuest) {
      setStatus("Sign in to delete workouts.");
      return;
    }

    const confirmed = window.confirm("Delete this entire workout? This cannot be undone.");

    if (!confirmed) return;

    const response = await authFetch(`/workouts/${encodeURIComponent(selectedWorkout.workout_id)}`, session, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      setStatus(error.detail || "Could not delete workout.");
      return;
    }

    setWorkouts((currentWorkouts) =>
      currentWorkouts.filter((workout) => workout.workout_id !== selectedWorkout.workout_id),
    );
    setSelectedWorkout(null);
    setSelectedWorkoutId("");
    setEditing(false);
    setStatus("Workout deleted.");
  }

  return (
    <main className="app-shell">
      <section className="panel flow-panel">
        <button className="ghost-action back-action" type="button" onClick={onBack}>
          Back to dashboard
        </button>
        <span className="eyebrow">Workout History</span>
        <h1>See Previous Workouts</h1>
        {isGuest && (
          <div className="lock-banner">
            Guest history uses sample workouts. Sign in to edit or delete workouts.
          </div>
        )}

        <form className="range-form" onSubmit={searchWorkouts}>
          <label>
            From
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} required />
          </label>
          <label>
            To
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} required />
          </label>
          <button className="primary-action" type="submit">
            Find Workouts
          </button>
        </form>

        {status && <div className="auth-message">{status}</div>}

        {workouts.length > 0 && (
          <div className="workout-picker">
            {workouts.map((workout) => (
              <button
                className={selectedWorkoutId === workout.workout_id ? "workout-pick active" : "workout-pick"}
                key={workout.workout_id}
                type="button"
                onClick={() => {
                  setSelectedWorkoutId(workout.workout_id);

                  if (isGuest) {
                    const demoWorkout = demoWorkoutDetails.find(
                      (demoDetail) => String(demoDetail.workout_id) === String(workout.workout_id),
                    );
                    setSelectedWorkout(demoWorkout || null);
                    setEditing(false);
                  }
                }}
              >
                <span>{formatDateOnly(workout.workout_date)}</span>
                <strong>{workout.workout_type}</strong>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedWorkout && (
        <section className="panel history-detail">
          <div className="panel-header">
            <div>
              <span>{formatDateOnly(selectedWorkout.workout_date)}</span>
              <h3>{selectedWorkout.workout_type}</h3>
            </div>
            <button
              className="secondary-action"
              disabled={isGuest}
              type="button"
              onClick={() => setEditing((current) => !current)}
            >
              {editing ? "Cancel Edit" : "Edit"}
            </button>
            <button className="danger-action" disabled={isGuest} type="button" onClick={deleteSelectedWorkout}>
              Delete
            </button>
            {isGuest && (
              <button className="ghost-action" type="button" onClick={onSignIn}>
                Sign in to edit
              </button>
            )}
          </div>

          {isGuest && (
            <div className="auth-message">
              Sign in to edit or delete workouts.
            </div>
          )}

          {editing && (
            <div className="session-fields edit-session-fields">
              <label>
                Date
                <input
                  type="date"
                  value={formatDateOnly(selectedWorkout.workout_date)}
                  onChange={(event) => updateWorkoutField("workout_date", event.target.value)}
                />
              </label>
              <label>
                Workout Type
                <input
                  type="text"
                  value={selectedWorkout.workout_type}
                  onChange={(event) => updateWorkoutField("workout_type", event.target.value)}
                />
              </label>
            </div>
          )}

          <div className="exercise-blocks">
            {selectedWorkout.exercises.map((exerciseBlock, exerciseIndex) => (
              <div className="exercise-block" key={`${exerciseBlock.exercise}-${exerciseIndex}`}>
                {editing ? (
                  <label className="exercise-name-edit">
                    Exercise
                    <input
                      type="text"
                      value={exerciseBlock.exercise}
                      onChange={(event) => updateExerciseName(exerciseIndex, event.target.value)}
                    />
                  </label>
                ) : (
                  <h4>{exerciseBlock.exercise}</h4>
                )}
                <table className="workout-table">
                  <thead>
                    <tr>
                      <th>Set</th>
                      <th>Weight (lbs)</th>
                      <th>Reps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exerciseBlock.sets.map((setRow, setIndex) => (
                      <tr key={setIndex}>
                        <td>
                          {editing ? (
                            <input
                              type="number"
                              min="1"
                              max={SET_LIMITS.user}
                              value={setRow.set_number}
                              onChange={(event) =>
                                updateWorkoutSet(exerciseIndex, setIndex, "set_number", Number(event.target.value))
                              }
                            />
                          ) : (
                            setRow.set_number
                          )}
                        </td>
                        <td>
                          {editing ? (
                            <input
                              type="number"
                              min={WEIGHT_LIMITS.min}
                              max={WEIGHT_LIMITS.max}
                              value={setRow.weight_lbs}
                              onChange={(event) =>
                                updateWorkoutSet(exerciseIndex, setIndex, "weight_lbs", Number(event.target.value))
                              }
                            />
                          ) : (
                            setRow.weight_lbs
                          )}
                        </td>
                        <td>
                          {editing ? (
                            <input
                              type="number"
                              min={REP_LIMITS.min}
                              max={REP_LIMITS.max}
                              value={setRow.reps}
                              onChange={(event) =>
                                updateWorkoutSet(exerciseIndex, setIndex, "reps", Number(event.target.value))
                              }
                            />
                          ) : (
                            setRow.reps
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {editing && (
            <button className="primary-action save-edits" type="button" onClick={saveEditedWorkout}>
              Save Workout
            </button>
          )}
        </section>
      )}
    </main>
  );
}

function SignedOutNotice({ onBack }) {
  return (
    <main className="app-shell narrow-shell">
      <section className="panel flow-panel">
        <button className="ghost-action back-action" type="button" onClick={onBack}>
          Back
        </button>
        <span className="eyebrow">Private Area</span>
        <h1>Sign in required.</h1>
        <p>Please sign in before opening owner workout tools.</p>
      </section>
    </main>
  );
}

function App() {
  const [screen, setScreen] = useState(() => {
    const hashScreen = window.location.hash.replace("#", "");
    return [
      "auth",
      "guest",
      "user",
      "add-workout",
      "add-exercise",
      "previous-workouts",
      "body-metrics",
      "guest-body-metrics",
      "guest-add-workout",
      "guest-add-exercise",
      "guest-previous-workouts",
    ].includes(hashScreen)
      ? hashScreen
      : "landing";
  });
  const [session, setSession] = useState(null);
  const [guestDraft, setGuestDraft] = useState(emptyDraft);
  const [guestSavedWorkout, setGuestSavedWorkout] = useState(null);
  const [guestBodyMetric, setGuestBodyMetric] = useState(null);

  useEffect(() => {
    if (!hasSupabaseConfig) return undefined;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session);
        setScreen("user");
        window.location.hash = "user";
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  function goToScreen(nextScreen) {
    if (screen.startsWith("guest-") && !nextScreen.startsWith("guest-")) {
      setGuestDraft(emptyDraft);
    }

    setScreen(nextScreen);
    window.location.hash = nextScreen === "landing" ? "" : nextScreen;
  }

  function handleAuthSuccess(nextSession) {
    setSession(nextSession);
    goToScreen("user");
  }

  async function handleSignOut() {
    if (hasSupabaseConfig) await supabase.auth.signOut();

    setSession(null);
    goToScreen("landing");
  }

  if (screen === "landing") {
    return <LandingScreen onGuest={() => goToScreen("guest")} onSignIn={() => goToScreen("auth")} />;
  }

  if (screen === "auth") {
    return <AuthScreen onBack={() => goToScreen("landing")} onAuthSuccess={handleAuthSuccess} />;
  }

  if (screen === "add-workout" || screen === "guest-add-workout") {
    const isGuestFlow = screen === "guest-add-workout";

    return (
      <WorkoutSetupPage
        isGuest={isGuestFlow}
        session={session}
        guestDraft={guestDraft}
        setGuestDraft={setGuestDraft}
        onBack={() => goToScreen(isGuestFlow ? "guest" : "user")}
        onContinue={() => goToScreen(isGuestFlow ? "guest-add-exercise" : "add-exercise")}
      />
    );
  }

  if (screen === "add-exercise" || screen === "guest-add-exercise") {
    const isGuestFlow = screen === "guest-add-exercise";

    return (
      <ExerciseEntryPage
        isGuest={isGuestFlow}
        session={session}
        guestDraft={guestDraft}
        setGuestDraft={setGuestDraft}
        exerciseOptions={isGuestFlow ? demoExercises : demoExercises}
        onBack={() => goToScreen(isGuestFlow ? "guest" : "user")}
        onWorkoutSaved={() => goToScreen(isGuestFlow ? "guest" : "user")}
        onGuestWorkoutSaved={setGuestSavedWorkout}
      />
    );
  }

  if (screen === "previous-workouts" || screen === "guest-previous-workouts") {
    const isGuestFlow = screen === "guest-previous-workouts";

    return (
      <PreviousWorkoutsPage
        isGuest={isGuestFlow}
        session={session}
        onBack={() => goToScreen(isGuestFlow ? "guest" : "user")}
        onSignIn={() => goToScreen("auth")}
      />
    );
  }

  if (screen === "body-metrics") {
    return (
      <BodyMetricsPage
        isGuest={false}
        session={session}
        onBack={() => goToScreen("user")}
      />
    );
  }

  if (screen === "guest-body-metrics") {
    return (
      <BodyMetricsPage
        isGuest
        session={session}
        guestBodyMetric={guestBodyMetric}
        setGuestBodyMetric={setGuestBodyMetric}
        onBack={() => goToScreen("guest")}
      />
    );
  }

  return (
    <Dashboard
      mode={screen}
      session={session}
      onReset={() => goToScreen("landing")}
      onSignOut={handleSignOut}
      onAddWorkout={() => goToScreen(screen === "guest" ? "guest-add-workout" : "add-workout")}
      onPreviousWorkouts={() => goToScreen(screen === "guest" ? "guest-previous-workouts" : "previous-workouts")}
      onBodyMetrics={() => goToScreen(screen === "guest" ? "guest-body-metrics" : "body-metrics")}
      onResumeWorkout={() => goToScreen("add-exercise")}
      guestSavedWorkout={guestSavedWorkout}
      guestBodyMetric={guestBodyMetric}
    />
  );
}

export default App;
