/**
 * ProgrammeStoryEngine — narrative for the current training block.
 */

import type { Programme, SessionCompletion } from "@/lib/domain/programme"
import type { HealthRecord } from "@/lib/domain/health"
import { calculateRecovery } from "@/lib/health/recovery"
import type { HevyWorkoutEntry } from "@/lib/health/workout"
import { buildExerciseHistories } from "@/lib/health/workout"

import type { ProgrammeAnalytics } from "./coaching-types"
import type { ProgrammeStoryParagraph } from "./coaching-types"

export function buildProgrammeStory(input: {
  programme: Programme
  currentWeek: number
  completions: SessionCompletion[]
  hevyWorkouts: HevyWorkoutEntry[]
  records: HealthRecord[]
  analytics: ProgrammeAnalytics
}): ProgrammeStoryParagraph[] {
  const paragraphs: ProgrammeStoryParagraph[] = []
  const { programme, currentWeek, completions, hevyWorkouts, records, analytics } =
    input

  paragraphs.push({
    id: "week-marker",
    body: `Week ${currentWeek} of ${programme.name}.`,
    confidence: "High",
  })

  const histories = buildExerciseHistories(hevyWorkouts)
  for (const history of histories) {
    if (history.sessions.length < 2) continue
    const prev = history.sessions[history.sessions.length - 2]
    const last = history.sessions[history.sessions.length - 1]
    if (!prev || !last) continue
    if (
      prev.bestWeightKg != null &&
      last.bestWeightKg != null &&
      last.bestWeightKg > prev.bestWeightKg
    ) {
      const delta = Math.round((last.bestWeightKg - prev.bestWeightKg) * 10) / 10
      paragraphs.push({
        id: `lift-${history.key}`,
        body: `${history.name} increased by ${delta} kg.`,
        confidence: "High",
      })
      break
    }
  }

  const recovery = calculateRecovery(records)
  if (recovery.score != null && recovery.score >= 65) {
    paragraphs.push({
      id: "recovery-high",
      body: "Recovery remained high through recent sessions.",
      confidence: "Medium",
    })
  } else if (recovery.score != null && recovery.score < 45) {
    paragraphs.push({
      id: "recovery-low",
      body: "Recovery has softened — protect intensity before chasing load.",
      confidence: "Medium",
    })
  }

  const lowerVolume = completions.reduce((sum, item) => {
    const lower = item.exercises.filter((ex) =>
      /squat|deadlift|leg|lunge|rdl|hamstring|glute/i.test(ex.exerciseName)
    )
    return (
      sum +
      lower.reduce((inner, ex) => inner + (ex.completedVolumeKg ?? 0), 0)
    )
  }, 0)
  const lowerTarget = completions.reduce((sum, item) => {
    const lower = item.exercises.filter((ex) =>
      /squat|deadlift|leg|lunge|rdl|hamstring|glute/i.test(ex.exerciseName)
    )
    return sum + lower.reduce((inner, ex) => inner + (ex.plannedVolumeKg ?? 0), 0)
  }, 0)
  if (lowerTarget > 0 && lowerVolume > lowerTarget * 1.05) {
    paragraphs.push({
      id: "lower-volume",
      body: "Lower body volume exceeded target across matched sessions.",
      confidence: "Medium",
    })
  }

  if (analytics.completionPct != null) {
    paragraphs.push({
      id: "adherence",
      body: `Average adherence reached ${analytics.completionPct}%.`,
      confidence: analytics.sessionsCompleted >= 3 ? "High" : "Medium",
    })
  }

  if (analytics.missedSessions > 0) {
    paragraphs.push({
      id: "missed",
      body: `${analytics.missedSessions} planned session${
        analytics.missedSessions === 1 ? "" : "s"
      } still unmatched to date.`,
      confidence: "Medium",
    })
  }

  return paragraphs.slice(0, 6)
}

export const ProgrammeStoryEngine = {
  build: buildProgrammeStory,
} as const
