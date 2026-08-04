/**
 * RecommendationEngine — personalised coaching suggestions with evidence.
 */

import type { HealthRecord } from "@/lib/domain/health"
import type { Workout } from "@/lib/domain/workout"

import { buildCardioIntelligence } from "./cardio-intelligence-engine"
import { buildMuscleBalance } from "./muscle-balance-engine"
import { buildRecoveryReadiness } from "./recovery-readiness-engine"
import { buildStepAnalytics } from "./step-analytics-engine"
import type {
  TrainingLimitation,
  TrainingRecommendation,
} from "./types"

export function buildRecommendations(input: {
  workouts: Workout[]
  records: HealthRecord[]
  limitations?: TrainingLimitation[]
}): TrainingRecommendation[] {
  const recommendations: TrainingRecommendation[] = []
  const balance = buildMuscleBalance(input.workouts)
  const readiness = buildRecoveryReadiness(input.workouts, input.records)
  const cardio = buildCardioIntelligence(input.workouts, 30)
  const steps = buildStepAnalytics(input.records, "30d")
  const limitations = input.limitations ?? []

  if (cardio.zone2Minutes < 90) {
    recommendations.push({
      id: "zone2",
      body: "Add one Zone 2 cardio session this week.",
      evidence: `About ${cardio.zone2Minutes} Zone 2 minutes in the last 30 days.`,
      confidence: cardio.zone2Minutes > 0 ? "Medium" : "Low",
    })
  }

  const chest = balance.byId.chest
  if (
    chest &&
    (chest.tone === "undertrained" || chest.tone === "below_target")
  ) {
    const gap = Math.max(1, Math.ceil(chest.recommendedMin - chest.weeklySets))
    recommendations.push({
      id: "chest-volume",
      body: `Increase weekly chest volume by ${Math.min(gap, 4)} sets.`,
      evidence: `${chest.weeklySets} weekly sets vs target ${chest.recommendedMin}–${chest.recommendedMax}.`,
      confidence: "High",
    })
  }

  const under = balance.groups
    .filter(
      (group) =>
        group.tone === "undertrained" || group.tone === "below_target"
    )
    .sort((a, b) => a.weeklySets - b.weeklySets)[0]
  if (under && under.id !== "chest") {
    recommendations.push({
      id: `muscle-${under.id}`,
      body: `Prioritise ${under.label.toLowerCase()} — add ${Math.min(
        3,
        Math.max(1, Math.ceil(under.recommendedMin - under.weeklySets))
      )} quality sets this week.`,
      evidence: `${under.weeklySets} weekly sets vs ${under.recommendedMin}–${under.recommendedMax} recommended.`,
      confidence: under.weeklySets > 0 ? "High" : "Medium",
    })
  }

  if (readiness.band === "recovery_recommended") {
    recommendations.push({
      id: "lighter-session",
      body: "Recovery suggests a lighter session tomorrow.",
      evidence: readiness.detail,
      confidence: "Medium",
    })
  } else if (readiness.band === "moderate") {
    recommendations.push({
      id: "quality-over-volume",
      body: "Keep intensity honest and avoid stacking extra volume tomorrow.",
      evidence: readiness.detail,
      confidence: "Medium",
    })
  }

  if (
    steps.average7d != null &&
    steps.average30d != null &&
    steps.average7d < steps.average30d - 800
  ) {
    const gap = Math.round(steps.average30d - steps.average7d)
    recommendations.push({
      id: "steps-gap",
      body: `Walking ${gap.toLocaleString("en-GB")} extra daily steps would return you to your 30-day average.`,
      evidence: `7-day average ${steps.average7d.toLocaleString("en-GB")} vs 30-day ${steps.average30d.toLocaleString("en-GB")}.`,
      confidence: "High",
    })
  }

  for (const limit of limitations.slice(0, 2)) {
    if (recommendations.some((item) => item.evidence === limit.evidence)) continue
    if (limit.id.startsWith("muscle-")) continue
    recommendations.push({
      id: `from-limit-${limit.id}`,
      body:
        limit.id === "freq-drop"
          ? "Protect two strength sessions this week to restore monthly frequency."
          : limit.id === "steps-down"
            ? "Rebuild step volume with one deliberate walk on rest days."
            : "Address the limiting factor before adding load.",
      evidence: limit.evidence,
      confidence: limit.confidence,
    })
  }

  return recommendations.slice(0, 6)
}

export const RecommendationEngine = {
  build: buildRecommendations,
} as const
