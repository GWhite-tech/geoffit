/**
 * ProgressionEngine — suggest load/rep updates from programme rules + history.
 */

import type {
  ExerciseTarget,
  Programme,
  ProgressionRule,
} from "@/lib/domain/programme"
import { normalizeExerciseKey } from "@/lib/domain/exercise-history"
import type { HevyWorkoutEntry } from "@/lib/health/workout"
import { buildExerciseHistories } from "@/lib/health/workout"

export type ProgressionSuggestion = {
  exerciseName: string
  ruleId: string
  currentTargetKg: number | null
  suggestedTargetKg: number | null
  detail: string
}

export function applyProgressionRules(
  programme: Programme,
  hevyWorkouts: HevyWorkoutEntry[]
): ProgressionSuggestion[] {
  const histories = buildExerciseHistories(hevyWorkouts)
  const suggestions: ProgressionSuggestion[] = []
  const rules =
    programme.progressionRules.length > 0
      ? programme.progressionRules
      : ([
          {
            id: "default-double",
            kind: "double_progression",
            description: "Default double progression",
            loadIncrementKg: 2.5,
            repRange: { min: 5, max: 8 },
          },
        ] satisfies ProgressionRule[])

  const targets = new Map<string, ExerciseTarget>()
  for (const week of programme.weeks) {
    for (const session of week.sessions) {
      for (const exercise of session.exercises) {
        const key = normalizeExerciseKey(exercise.exerciseName)
        if (!targets.has(key)) targets.set(key, exercise)
      }
    }
  }

  for (const [key, target] of targets) {
    const history = histories.find((item) => item.key === key)
    if (!history || history.sessions.length < 2) continue
    const last = history.sessions[history.sessions.length - 1]!
    const rule = rules[0]!
    const increment = rule.loadIncrementKg ?? 2.5
    const topReps =
      typeof target.reps === "number" ? target.reps : target.reps.max
    const hitTop =
      last.sets.filter(
        (set) =>
          set.reps != null &&
          set.reps >= topReps &&
          (target.targetWeightKg == null ||
            set.weightKg == null ||
            set.weightKg >= target.targetWeightKg * 0.98)
      ).length >= Math.max(1, Math.floor(target.sets * 0.75))

    if (rule.kind === "double_progression" && hitTop) {
      const base =
        target.targetWeightKg ??
        last.bestWeightKg ??
        null
      suggestions.push({
        exerciseName: target.exerciseName,
        ruleId: rule.id,
        currentTargetKg: base,
        suggestedTargetKg: base != null ? base + increment : null,
        detail: `Hit top of rep range (~${topReps}). Suggest +${increment} kg next time.`,
      })
    } else if (rule.kind === "linear_load" && last.bestWeightKg != null) {
      suggestions.push({
        exerciseName: target.exerciseName,
        ruleId: rule.id,
        currentTargetKg: target.targetWeightKg ?? last.bestWeightKg,
        suggestedTargetKg: last.bestWeightKg + increment,
        detail: `Linear progression — add ${increment} kg if the last session was clean.`,
      })
    } else if (rule.kind === "rpe_based" && last.bestWeightKg != null) {
      suggestions.push({
        exerciseName: target.exerciseName,
        ruleId: rule.id,
        currentTargetKg: target.targetWeightKg ?? last.bestWeightKg,
        suggestedTargetKg: last.bestWeightKg,
        detail: `Hold load near ${last.bestWeightKg} kg and adjust by RPE (~${target.targetRpe ?? 7.5}).`,
      })
    }
  }

  return suggestions.slice(0, 12)
}

export const ProgressionEngine = {
  apply: applyProgressionRules,
} as const
