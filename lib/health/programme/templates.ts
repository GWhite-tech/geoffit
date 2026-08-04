/**
 * Built-in programme templates — seed data for ProgrammeStore.
 * Future: import / AI / coach / share all produce the same Programme shape.
 */

import type {
  ExerciseTarget,
  PlannedSession,
  Programme,
  ProgrammeType,
  ProgrammeWeek,
} from "@/lib/domain/programme"

function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function exercise(
  name: string,
  sets: number,
  reps: number | { min: number; max: number },
  order: number,
  extras: Partial<ExerciseTarget> = {}
): ExerciseTarget {
  return {
    id: id("ex"),
    exerciseName: name,
    exerciseKey: name.trim().toLowerCase(),
    sets,
    reps,
    targetWeightKg: null,
    targetRpe: extras.targetRpe ?? 7.5,
    restSeconds: extras.restSeconds ?? 120,
    tempo: extras.tempo ?? null,
    notes: extras.notes ?? null,
    order,
    isOptional: extras.isOptional ?? false,
  }
}

function session(
  name: string,
  dayOfWeek: number,
  order: number,
  exercises: ExerciseTarget[],
  focus?: string
): PlannedSession {
  return {
    id: id("session"),
    name,
    dayOfWeek,
    order,
    focus: focus ?? null,
    notes: null,
    exercises,
  }
}

function week(
  weekNumber: number,
  sessions: PlannedSession[],
  isDeload = false
): ProgrammeWeek {
  return {
    id: id("week"),
    weekNumber,
    label: isDeload ? `Week ${weekNumber} (Deload)` : `Week ${weekNumber}`,
    isDeload,
    notes: null,
    sessions,
  }
}

function baseMeta(type: ProgrammeType, name: string): Omit<
  Programme,
  "weeks" | "weeklySchedule" | "splitLabel" | "progressionRules"
> {
  const now = new Date().toISOString()
  return {
    id: id(`programme-${type}`),
    name,
    goal: type === "strength" ? "strength" : type === "hypertrophy" ? "hypertrophy" : "powerbuilding",
    type,
    startDate: now.slice(0, 10),
    endDate: null,
    notes: null,
    source: "template",
    status: "draft",
    version: { version: 1, createdAt: now, createdBy: "template" },
    parentProgrammeId: null,
    createdAt: now,
    updatedAt: now,
    deloadEveryWeeks: 4,
  }
}

export function createUpperLowerTemplate(): Programme {
  const upper = session(
    "Upper",
    0,
    0,
    [
      exercise("Bench Press", 4, { min: 5, max: 8 }, 0, { restSeconds: 180 }),
      exercise("Barbell Row", 4, { min: 6, max: 10 }, 1),
      exercise("Overhead Press", 3, { min: 6, max: 10 }, 2),
      exercise("Lat Pulldown", 3, { min: 8, max: 12 }, 3),
      exercise("Lateral Raise", 3, { min: 12, max: 15 }, 4, { restSeconds: 60 }),
      exercise("Tricep Pushdown", 2, { min: 10, max: 15 }, 5, { restSeconds: 60 }),
    ],
    "Upper body strength"
  )
  const lower = session(
    "Lower",
    2,
    1,
    [
      exercise("Back Squat", 4, { min: 5, max: 8 }, 0, { restSeconds: 180 }),
      exercise("Romanian Deadlift", 3, { min: 6, max: 10 }, 1),
      exercise("Leg Press", 3, { min: 8, max: 12 }, 2),
      exercise("Walking Lunge", 2, { min: 8, max: 12 }, 3),
      exercise("Calf Raise", 3, { min: 10, max: 15 }, 4, { restSeconds: 60 }),
    ],
    "Lower body strength"
  )
  const upper2 = { ...upper, id: id("session"), dayOfWeek: 4, order: 2 }
  const lower2 = { ...lower, id: id("session"), dayOfWeek: 5, order: 3, name: "Lower" }

  const weeks = [1, 2, 3, 4].map((n) =>
    week(n, [upper, lower, upper2, lower2].map((s, i) => ({
      ...s,
      id: id("session"),
      order: i,
      exercises: s.exercises.map((e, ei) => ({ ...e, id: id("ex"), order: ei })),
    })), n === 4)
  )

  return {
    ...baseMeta("upper_lower", "Upper / Lower Strength"),
    splitLabel: "Upper / Lower",
    weeklySchedule: ["Upper", "Rest", "Lower", "Rest", "Upper", "Lower", "Rest"],
    progressionRules: [
      {
        id: id("prog"),
        kind: "double_progression",
        description: "Add 2.5 kg when top of rep range is hit on all working sets.",
        loadIncrementKg: 2.5,
        repRange: { min: 5, max: 8 },
      },
    ],
    weeks,
    goal: "strength",
  }
}

export function createPushPullLegsTemplate(): Programme {
  const push = session(
    "Push",
    0,
    0,
    [
      exercise("Bench Press", 4, { min: 5, max: 8 }, 0, { restSeconds: 180 }),
      exercise("Overhead Press", 3, { min: 6, max: 10 }, 1),
      exercise("Incline Dumbbell Press", 3, { min: 8, max: 12 }, 2),
      exercise("Lateral Raise", 3, { min: 12, max: 15 }, 3, { restSeconds: 60 }),
      exercise("Tricep Pushdown", 3, { min: 10, max: 15 }, 4, { restSeconds: 60 }),
    ],
    "Push"
  )
  const pull = session(
    "Pull",
    2,
    1,
    [
      exercise("Deadlift", 3, { min: 3, max: 5 }, 0, { restSeconds: 210 }),
      exercise("Barbell Row", 4, { min: 6, max: 10 }, 1),
      exercise("Lat Pulldown", 3, { min: 8, max: 12 }, 2),
      exercise("Face Pull", 3, { min: 12, max: 15 }, 3, { restSeconds: 60 }),
      exercise("Barbell Curl", 3, { min: 8, max: 12 }, 4, { restSeconds: 60 }),
    ],
    "Pull"
  )
  const legs = session(
    "Legs",
    4,
    2,
    [
      exercise("Back Squat", 4, { min: 5, max: 8 }, 0, { restSeconds: 180 }),
      exercise("Romanian Deadlift", 3, { min: 6, max: 10 }, 1),
      exercise("Leg Press", 3, { min: 8, max: 12 }, 2),
      exercise("Leg Curl", 3, { min: 10, max: 15 }, 3),
      exercise("Calf Raise", 3, { min: 10, max: 15 }, 4, { restSeconds: 60 }),
    ],
    "Legs"
  )

  const weeks = [1, 2, 3, 4].map((n) =>
    week(
      n,
      [push, pull, legs].map((s, i) => ({
        ...s,
        id: id("session"),
        order: i,
        exercises: s.exercises.map((e, ei) => ({ ...e, id: id("ex"), order: ei })),
      })),
      n === 4
    )
  )

  return {
    ...baseMeta("push_pull_legs", "Push Pull Legs"),
    splitLabel: "Push / Pull / Legs",
    weeklySchedule: ["Push", "Rest", "Pull", "Rest", "Legs", "Rest", "Rest"],
    progressionRules: [
      {
        id: id("prog"),
        kind: "double_progression",
        description: "Add load when all sets hit the top of the rep range.",
        loadIncrementKg: 2.5,
        repRange: { min: 5, max: 8 },
      },
    ],
    weeks,
    goal: "hypertrophy",
    type: "push_pull_legs",
  }
}

export function createFullBodyTemplate(): Programme {
  const a = session(
    "Full Body A",
    0,
    0,
    [
      exercise("Back Squat", 3, { min: 5, max: 8 }, 0),
      exercise("Bench Press", 3, { min: 5, max: 8 }, 1),
      exercise("Barbell Row", 3, { min: 6, max: 10 }, 2),
      exercise("Overhead Press", 2, { min: 6, max: 10 }, 3),
    ],
    "Full body"
  )
  const b = session(
    "Full Body B",
    2,
    1,
    [
      exercise("Deadlift", 3, { min: 3, max: 5 }, 0),
      exercise("Incline Dumbbell Press", 3, { min: 8, max: 12 }, 1),
      exercise("Lat Pulldown", 3, { min: 8, max: 12 }, 2),
      exercise("Walking Lunge", 2, { min: 8, max: 12 }, 3),
    ],
    "Full body"
  )
  const c = session(
    "Full Body C",
    4,
    2,
    [
      exercise("Front Squat", 3, { min: 5, max: 8 }, 0),
      exercise("Bench Press", 3, { min: 5, max: 8 }, 1),
      exercise("Pull-up", 3, { min: 5, max: 10 }, 2),
      exercise("Romanian Deadlift", 2, { min: 6, max: 10 }, 3),
    ],
    "Full body"
  )

  const weeks = [1, 2, 3, 4].map((n) =>
    week(
      n,
      [a, b, c].map((s, i) => ({
        ...s,
        id: id("session"),
        order: i,
        exercises: s.exercises.map((e, ei) => ({ ...e, id: id("ex"), order: ei })),
      })),
      n === 4
    )
  )

  return {
    ...baseMeta("full_body", "Full Body 3×"),
    splitLabel: "Full Body",
    weeklySchedule: ["Full Body A", "Rest", "Full Body B", "Rest", "Full Body C", "Rest", "Rest"],
    progressionRules: [
      {
        id: id("prog"),
        kind: "linear_load",
        description: "Add 2.5 kg on main lifts each successful week.",
        loadIncrementKg: 2.5,
        applyEverySessions: 1,
      },
    ],
    weeks,
    goal: "general_fitness",
    type: "full_body",
  }
}

export function listProgrammeTemplates(): Programme[] {
  return [
    createUpperLowerTemplate(),
    createPushPullLegsTemplate(),
    createFullBodyTemplate(),
  ]
}
