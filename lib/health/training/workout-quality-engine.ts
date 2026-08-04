/**
 * WorkoutQualityEngine — per-session quality scores + 30-day trend.
 */

import type { Workout } from "@/lib/domain/workout"
import { isWorkingSet } from "@/lib/health/workout"

import { classifyMuscleGroup } from "./muscle-groups"
import { average, clamp, inLastDays, inPreviousWindow } from "./period"
import { StrengthEngine } from "./strength-engine"
import type { WorkoutQualityResult, WorkoutQualityScores } from "./types"

const COMPOUND =
  /squat|deadlift|bench|row|press|pull.?up|chin.?up|clean|snatch|lunge|hip thrust|rdl|overhead/i

function scoreWorkout(
  workout: Workout,
  peerVolumes: number[]
): WorkoutQualityScores {
  const exercises = workout.exercises ?? []
  const workingSets = exercises.flatMap((exercise) =>
    exercise.sets.filter((set) => isWorkingSet(set.setType))
  )
  const volume = workout.volumeKg ?? 0
  const peerAvg = average(peerVolumes.filter((value) => value > 0)) ?? volume
  const volumeScore =
    peerAvg > 0 ? clamp((volume / peerAvg) * 70) : volume > 0 ? 55 : null

  const intensities = workingSets
    .map((set) => {
      if (set.estimated1RmKg == null || set.weightKg == null || set.estimated1RmKg <= 0) {
        return null
      }
      return (set.weightKg / set.estimated1RmKg) * 100
    })
    .filter((value): value is number => value != null)
  const intensityScore =
    intensities.length > 0 ? clamp(average(intensities) ?? 0) : null

  const unique = new Set(exercises.map((exercise) => exercise.name.toLowerCase()))
  const varietyScore =
    exercises.length === 0
      ? null
      : clamp((unique.size / Math.max(4, exercises.length)) * 100)

  const compounds = exercises.filter((exercise) => COMPOUND.test(exercise.name))
  const compoundRatio =
    exercises.length === 0
      ? null
      : Math.round((compounds.length / exercises.length) * 100)

  const durationMin = workout.durationSeconds / 60
  const effortScore = clamp(
    (volume > 0 ? Math.min(50, volume / 400) : 0) +
      Math.min(35, durationMin / 2) +
      (workout.rpe != null ? workout.rpe * 1.5 : 10)
  )

  const groups = new Set(
    exercises.map((exercise) => classifyMuscleGroup(exercise.name))
  )
  const loadScore = clamp(
    (volumeScore ?? 40) * 0.45 +
      (intensityScore ?? 40) * 0.25 +
      effortScore * 0.2 +
      Math.min(20, groups.size * 4)
  )

  const parts = [
    volumeScore,
    intensityScore,
    varietyScore,
    compoundRatio,
    effortScore,
    loadScore,
  ].filter((value): value is number => value != null)

  return {
    workoutId: workout.id,
    date: workout.startDate.slice(0, 10),
    name: workout.name,
    volumeScore: volumeScore != null ? Math.round(volumeScore) : null,
    intensityScore: intensityScore != null ? Math.round(intensityScore) : null,
    varietyScore: varietyScore != null ? Math.round(varietyScore) : null,
    compoundRatio,
    effortScore: Math.round(effortScore),
    loadScore: Math.round(loadScore),
    overall:
      parts.length === 0
        ? null
        : Math.round(parts.reduce((sum, value) => sum + value, 0) / parts.length),
  }
}

export function buildWorkoutQuality(workouts: Workout[]): WorkoutQualityResult {
  const strength = StrengthEngine.strengthSessions(workouts).filter(
    (workout) => (workout.exercises?.length ?? 0) > 0
  )
  const last30 = inLastDays(strength, 30)
  const prev30 = inPreviousWindow(strength, 30)
  const peerVolumes = last30.map((workout) => workout.volumeKg ?? 0)

  const sessions = last30
    .map((workout) => scoreWorkout(workout, peerVolumes))
    .reverse()

  const avg = average(
    sessions
      .map((session) => session.overall)
      .filter((value): value is number => value != null)
  )
  const prevAvg = average(
    prev30
      .map((workout) => scoreWorkout(workout, peerVolumes).overall)
      .filter((value): value is number => value != null)
  )

  const change30d =
    avg != null && prevAvg != null ? Math.round(avg - prevAvg) : null

  return {
    sessions: sessions.slice(0, 12),
    average: avg != null ? Math.round(avg) : null,
    change30d,
    trendLabel:
      change30d == null
        ? null
        : change30d >= 3
          ? "Improving over 30 days"
          : change30d <= -3
            ? "Softening over 30 days"
            : "Stable over 30 days",
  }
}

export const WorkoutQualityEngine = {
  build: buildWorkoutQuality,
} as const
