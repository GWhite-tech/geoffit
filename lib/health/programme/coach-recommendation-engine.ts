/**
 * CoachRecommendationEngine — programme-aware coaching suggestions.
 * Never mutates the programme — recommendations only.
 */

import type { Programme } from "@/lib/domain/programme"
import type { ProgressionSuggestion } from "./progression-engine"
import type { AdaptiveProgressionAdvice } from "./coaching-types"
import type { CoachRecommendation } from "./coaching-types"
import type { ProgrammeAnalytics } from "./coaching-types"
import type { ProgrammeHealthResult } from "./coaching-types"

export function buildCoachRecommendations(input: {
  programme: Programme
  analytics: ProgrammeAnalytics
  health: ProgrammeHealthResult
  adaptive: AdaptiveProgressionAdvice[]
  progression: ProgressionSuggestion[]
}): CoachRecommendation[] {
  const recommendations: CoachRecommendation[] = []

  for (const item of input.adaptive) {
    if (item.action === "increase_load") {
      recommendations.push({
        id: `adaptive-${item.id}`,
        body: item.detail,
        evidence: item.evidence.join(" · "),
        confidence: item.confidence,
      })
    }
    if (item.action === "schedule_deload" || item.action === "reduce") {
      recommendations.push({
        id: `adaptive-${item.id}`,
        body: item.detail,
        evidence: item.evidence.join(" · "),
        confidence: item.confidence,
      })
    }
    if (item.action === "repeat_week") {
      recommendations.push({
        id: `adaptive-${item.id}`,
        body: item.detail,
        evidence: item.evidence.join(" · "),
        confidence: item.confidence,
      })
    }
  }

  for (const tip of input.progression.slice(0, 3)) {
    recommendations.push({
      id: `prog-${tip.ruleId}-${tip.exerciseName}`,
      body:
        tip.suggestedTargetKg != null
          ? `Increase ${tip.exerciseName} toward ${tip.suggestedTargetKg} kg next week.`
          : tip.detail,
      evidence: tip.detail,
      confidence: "Medium",
    })
  }

  if (input.health.status === "recovery_limited") {
    recommendations.push({
      id: "delay-progression",
      body: "Recovery suggests delaying progression until sleep improves.",
      evidence: input.health.detail,
      confidence: "Medium",
    })
  }

  if (
    input.analytics.averageWorkoutQuality != null &&
    input.analytics.averageWorkoutQuality >= 70 &&
    input.health.status === "on_track"
  ) {
    recommendations.push({
      id: "maintain-bench-volume",
      body: "Maintain primary lift volume — quality is high enough to progress selectively.",
      evidence: `Average workout quality ${input.analytics.averageWorkoutQuality}.`,
      confidence: "Low",
    })
  }

  if (input.analytics.missedSessions >= 2) {
    recommendations.push({
      id: "reduce-accessories",
      body: "Reduce accessory work after missed sessions — protect the main lifts first.",
      evidence: `${input.analytics.missedSessions} unmatched planned sessions to date.`,
      confidence: "Medium",
    })
  }

  // Dedupe by body text
  const seen = new Set<string>()
  return recommendations
    .filter((item) => {
      if (seen.has(item.body)) return false
      seen.add(item.body)
      return true
    })
    .slice(0, 6)
}

export const CoachRecommendationEngine = {
  build: buildCoachRecommendations,
} as const
