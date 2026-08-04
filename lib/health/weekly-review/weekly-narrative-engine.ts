/**
 * WeeklyNarrativeEngine — headline, health story, coach note.
 */

import type { WeeklyReviewView, WeeklyStoryParagraph } from "./types"

export function buildWeeklyHeadline(view: Pick<
  WeeklyReviewView,
  "wins" | "training" | "recovery" | "nutrition" | "score" | "bodyComposition"
>): string {
  const parts: string[] = []
  const weight = view.bodyComposition.metrics.find((m) => m.id === "weight")
  const lean = view.bodyComposition.metrics.find((m) => m.id === "lean_mass")

  if (view.score.change != null && view.score.change >= 2) {
    parts.push("You had one of your strongest weeks this month.")
  } else if (view.wins.length >= 3) {
    parts.push("This was a high-quality week with several clear wins.")
  } else {
    parts.push("This week delivered a mixed but useful set of signals.")
  }

  if (weight?.improving && lean?.improving !== false) {
    parts.push(
      "Weight continued to move in a favourable direction while lean mass held."
    )
  } else if (weight?.improving) {
    parts.push("Weight trend improved — keep an eye on lean mass and protein.")
  }

  if (view.recovery.recoveryAvg != null && view.recovery.recoveryAvg >= 70) {
    parts.push(
      view.training.volumeKg
        ? "Recovery remained high despite meaningful training load."
        : "Recovery stayed supportive."
    )
  }

  if (view.nutrition.proteinDaysHit >= 5) {
    parts.push("Nutrition consistency stayed excellent.")
  }

  if (
    view.recovery.sleepAvgHours != null &&
    view.recovery.narrative.some((line) => /sleep/i.test(line))
  ) {
    parts.push("Sleep patterns were a notable part of the week.")
  }

  return parts.join(" ")
}

export function buildWeeklyStory(view: Pick<
  WeeklyReviewView,
  "wins" | "training" | "recovery" | "nutrition" | "bodyComposition" | "positiveChanges"
>): WeeklyStoryParagraph[] {
  const story: WeeklyStoryParagraph[] = []
  const weight = view.bodyComposition.metrics.find((m) => m.id === "weight")
  const lean = view.bodyComposition.metrics.find((m) => m.id === "lean_mass")

  if (weight?.improving && lean?.improving !== false) {
    story.push({
      id: "recomp",
      body: "Weight loss progressed while muscle-supporting signals stayed intact.",
      confidence: "Medium",
    })
  }

  if (view.nutrition.avgProtein != null && view.nutrition.avgProtein >= 180) {
    story.push({
      id: "protein-lean",
      body: "Higher protein intake likely contributed to preserving lean mass.",
      confidence: "Medium",
    })
  }

  if (
    view.recovery.recoveryAvg != null &&
    view.recovery.recoveryAvg >= 70 &&
    view.recovery.sleepAvgHours != null &&
    view.recovery.sleepAvgHours >= 7
  ) {
    story.push({
      id: "sleep-recovery",
      body: "Improved recovery coincided with solid average sleep.",
      confidence: "Medium",
    })
  }

  if (view.training.narrative[0]) {
    story.push({
      id: "training",
      body: view.training.narrative[0],
      confidence: "High",
    })
  }

  if (view.positiveChanges[0]) {
    story.push({
      id: "top-change",
      body: `${view.positiveChanges[0].label} moved ${view.positiveChanges[0].value} — one of the clearest positive shifts this week.`,
      confidence: "High",
    })
  }

  return story.slice(0, 5)
}

export function buildCoachNote(view: Pick<
  WeeklyReviewView,
  "wins" | "score" | "training" | "nutrition" | "recovery" | "focus"
>): string {
  const wins = view.wins.length
  if (view.score.change != null && view.score.change >= 2 && wins >= 2) {
    return "You've built excellent consistency recently. The current approach is producing measurable progress while strength work stays productive. Keep prioritising recovery and protein as training demand rises."
  }
  if (view.recovery.recoveryAvg != null && view.recovery.recoveryAvg < 50) {
    return "Progress this week was real, but recovery is asking for attention. Protect sleep and keep the next hard sessions honest — consistency beats forcing load when readiness is soft."
  }
  if (view.training.strengthSessions >= 3 && view.nutrition.proteinDaysHit >= 5) {
    return "Strength and protein both landed well this week. Hold that pairing — it is the most reliable foundation for body composition and performance over the next block."
  }
  return "Steady inputs are compounding. Focus on the few priorities below, keep logging cleanly, and let the next week confirm the trend rather than chasing perfection."
}

export const WeeklyNarrativeEngine = {
  headline: buildWeeklyHeadline,
  story: buildWeeklyStory,
  coachNote: buildCoachNote,
} as const
