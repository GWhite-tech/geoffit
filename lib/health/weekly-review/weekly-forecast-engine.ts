/**
 * WeeklyForecastEngine — directional projections with confidence.
 */

import type { WeeklyForecastItem, WeeklyReviewView } from "./types"

export function buildWeeklyForecast(
  view: Pick<
    WeeklyReviewView,
    "bodyComposition" | "training" | "recovery" | "score" | "blood" | "positiveChanges"
  >
): WeeklyForecastItem[] {
  const forecast: WeeklyForecastItem[] = []
  const weight = view.bodyComposition.metrics.find((m) => m.id === "weight")
  const fat = view.bodyComposition.metrics.find((m) => m.id === "body_fat")

  if (weight?.improving) {
    forecast.push({
      id: "weight",
      label: "Weight",
      projection:
        "Likely to keep drifting down if protein and walking hold near this week’s levels.",
      confidence: "Medium",
    })
  } else {
    forecast.push({
      id: "weight",
      label: "Weight",
      projection: "Expect a quieter week on the scale unless intake or steps shift.",
      confidence: "Low",
    })
  }

  forecast.push({
    id: "body-fat",
    label: "Body fat",
    projection:
      fat?.improving
        ? "Body fat should continue a gradual downward trend if the deficit stays mild."
        : "Body-fat change may be flat until weekly activity or intake moves.",
    confidence: fat?.delta ? "Medium" : "Low",
  })

  forecast.push({
    id: "training",
    label: "Training",
    projection:
      view.training.strengthSessions >= 3
        ? "Strength rhythm looks sustainable — expect similar session density."
        : "Training consistency may need deliberate scheduling to avoid another soft week.",
    confidence: view.training.strengthSessions >= 2 ? "High" : "Medium",
  })

  forecast.push({
    id: "recovery",
    label: "Recovery",
    projection:
      view.recovery.recoveryAvg != null && view.recovery.recoveryAvg >= 70
        ? "Recovery should remain supportive if sleep stays near this week’s average."
        : "Recovery may stay capped until sleep debt is reduced.",
    confidence: view.recovery.recoveryAvg != null ? "Medium" : "Low",
  })

  forecast.push({
    id: "hba1c",
    label: "HbA1c",
    projection: view.blood.hasNewTests
      ? "New labs this week give a fresh anchor — trend interpretation needs the next panel."
      : "No new labs this week; HbA1c outlook unchanged until the next draw.",
    confidence: "Low",
  })

  forecast.push({
    id: "programme",
    label: "Programme progress",
    projection:
      view.training.adherencePct != null && view.training.adherencePct >= 80
        ? "Programme progress should advance cleanly if the next planned session is completed."
        : "Programme pace may slip unless the next planned session is protected.",
    confidence: view.training.adherencePct != null ? "Medium" : "Low",
  })

  return forecast.slice(0, 6)
}

export const WeeklyForecastEngine = {
  build: buildWeeklyForecast,
} as const
