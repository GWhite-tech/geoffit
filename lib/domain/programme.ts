/**
 * Training Programme domain — structured weeks → sessions → exercises → targets.
 *
 * Designed for future import, AI generation, coach creation, sharing, and
 * version history without reshaping the core model.
 */

export type ProgrammeType =
  | "upper_lower"
  | "push_pull_legs"
  | "full_body"
  | "powerbuilding"
  | "strength"
  | "hypertrophy"
  | "custom"

export type ProgrammeSourceKind =
  | "manual"
  | "template"
  | "imported"
  | "ai"
  | "coach"
  | "shared"

export type ProgrammeGoal =
  | "strength"
  | "hypertrophy"
  | "powerbuilding"
  | "general_fitness"
  | "fat_loss"
  | "custom"

export type ProgressionRuleKind =
  | "double_progression"
  | "linear_load"
  | "rpe_based"
  | "percentage"
  | "none"

export type ProgressionRule = {
  id: string
  kind: ProgressionRuleKind
  /** e.g. add 2.5kg when top of rep range hit */
  description: string
  loadIncrementKg?: number
  repRange?: { min: number; max: number }
  applyEverySessions?: number
}

export type ExerciseTarget = {
  id: string
  /** Display name — matched to Hevy via normalizeExerciseKey */
  exerciseName: string
  /** Optional stable key for future catalogue linking */
  exerciseKey?: string
  sets: number
  reps: number | { min: number; max: number }
  targetWeightKg?: number | null
  targetRpe?: number | null
  restSeconds?: number | null
  tempo?: string | null
  notes?: string | null
  /** Order within the session */
  order: number
  isOptional?: boolean
}

export type PlannedSession = {
  id: string
  name: string
  /** Day offset within the week (0 = Mon … 6 = Sun), or null if unordered */
  dayOfWeek?: number | null
  order: number
  focus?: string | null
  notes?: string | null
  exercises: ExerciseTarget[]
}

export type ProgrammeWeek = {
  id: string
  weekNumber: number
  label?: string | null
  isDeload: boolean
  notes?: string | null
  sessions: PlannedSession[]
}

export type ProgrammeVersionMeta = {
  version: number
  createdAt: string
  createdBy?: ProgrammeSourceKind
  changeNote?: string | null
}

/**
 * Canonical programme entity.
 * Immutability of history is handled by appending ProgrammeVersionMeta
 * and cloning programmes rather than mutating past weeks in place later.
 */
export type Programme = {
  id: string
  name: string
  goal: ProgrammeGoal
  type: ProgrammeType
  startDate: string
  endDate: string | null
  splitLabel: string
  weeklySchedule: string[]
  weeks: ProgrammeWeek[]
  progressionRules: ProgressionRule[]
  deloadEveryWeeks?: number | null
  notes?: string | null
  source: ProgrammeSourceKind
  /** Active programme flag is store-level; kept here for snapshots/export */
  status: "draft" | "active" | "completed" | "archived"
  version: ProgrammeVersionMeta
  /** Parent id when this is a revision of a shared/imported programme */
  parentProgrammeId?: string | null
  createdAt: string
  updatedAt: string
}

export type ExerciseCompletionStatus =
  | "completed"
  | "skipped"
  | "modified"
  | "exceeded"
  | "partial"

export type ExerciseCompletion = {
  plannedExerciseId: string
  exerciseName: string
  status: ExerciseCompletionStatus
  plannedSets: number
  completedSets: number
  plannedRepsLabel: string
  completedReps: number | null
  plannedWeightKg: number | null
  bestWeightKg: number | null
  plannedVolumeKg: number | null
  completedVolumeKg: number | null
  detail: string
}

export type SessionCompletion = {
  id: string
  programmeId: string
  plannedSessionId: string
  plannedSessionName: string
  weekNumber: number
  workoutId: string | null
  workoutName: string | null
  workoutDate: string | null
  matched: boolean
  completionPct: number
  exercisesCompleted: number
  exercisesPlanned: number
  setsCompleted: number
  setsPlanned: number
  volumeAchievedKg: number
  volumeTargetKg: number | null
  targetAchieved: boolean
  exercises: ExerciseCompletion[]
  adherenceLabel: string
}

export type ProgrammeMatch = {
  workoutId: string
  plannedSessionId: string
  weekNumber: number
  score: number
  reason: string
}

export const PROGRAMME_TYPE_LABELS: Record<ProgrammeType, string> = {
  upper_lower: "Upper / Lower",
  push_pull_legs: "Push Pull Legs",
  full_body: "Full Body",
  powerbuilding: "Powerbuilding",
  strength: "Strength",
  hypertrophy: "Hypertrophy",
  custom: "Custom",
}

export function repsLabel(reps: ExerciseTarget["reps"]): string {
  if (typeof reps === "number") return String(reps)
  return `${reps.min}–${reps.max}`
}

export function targetRepsMid(reps: ExerciseTarget["reps"]): number {
  if (typeof reps === "number") return reps
  return Math.round((reps.min + reps.max) / 2)
}
