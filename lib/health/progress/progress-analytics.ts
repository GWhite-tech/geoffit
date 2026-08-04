import type { BloodTest } from "@/lib/domain/blood"
import type { HealthRecord } from "@/lib/domain/health"
import type { NutritionDay, NutritionTargets } from "@/lib/domain/nutrition"
import type { DoseEvent, Treatment } from "@/lib/domain/treatment"

import { buildCauseAndEffect } from "./cause-effect-engine"
import { buildCorrelationInsights } from "./correlation-engine"
import { calculateHealthScore } from "./health-score-engine"
import { buildInterventionMarkers } from "./interventions"
import { buildMilestones } from "./milestone-engine"
import { buildProjections } from "./projection-engine"
import { buildBodyCompositionSeries } from "./series-builders"
import { buildHealthStory } from "./story-engine"
import { buildTrendCards } from "./trend-engine"
import { buildWhatsChanged } from "./whats-changed-engine"
import { buildWhatsNext } from "./whats-next-engine"
import type { ProgressRange, ProgressView } from "./types"

export type ProgressAnalyticsInput = {
  records: HealthRecord[]
  bloodTests: BloodTest[]
  nutritionDays: NutritionDay[]
  nutritionTargets: NutritionTargets
  treatments: Treatment[]
  events: DoseEvent[]
  range: ProgressRange
}

/**
 * ProgressAnalytics — assembles the Progress page read model from existing stores.
 */
export function buildProgressView(input: ProgressAnalyticsInput): ProgressView {
  const interventions = buildInterventionMarkers(
    input.treatments,
    input.events,
    input.bloodTests
  )

  const healthScore = calculateHealthScore({
    records: input.records,
    bloodTests: input.bloodTests,
    nutritionDays: input.nutritionDays,
    nutritionTargets: input.nutritionTargets,
    treatments: input.treatments,
    events: input.events,
  })

  const { improvements, achievements } = buildMilestones({
    records: input.records,
    bloodTests: input.bloodTests,
    nutritionDays: input.nutritionDays,
    nutritionTargets: input.nutritionTargets,
  })

  const projections = buildProjections({
    records: input.records,
    bloodTests: input.bloodTests,
  })

  const hasData =
    input.records.length > 0 ||
    input.bloodTests.length > 0 ||
    input.nutritionDays.length > 0 ||
    input.treatments.length > 0

  return {
    hasData,
    range: input.range,
    healthScore,
    healthStory: buildHealthStory({
      records: input.records,
      bloodTests: input.bloodTests,
      nutritionDays: input.nutritionDays,
      nutritionTargets: input.nutritionTargets,
      interventions,
      range: input.range,
    }),
    causeAndEffect: buildCauseAndEffect({
      records: input.records,
      bloodTests: input.bloodTests,
      nutritionDays: input.nutritionDays,
      interventions,
    }),
    whatsChanged: buildWhatsChanged({
      records: input.records,
      bloodTests: input.bloodTests,
      nutritionDays: input.nutritionDays,
      range: input.range,
    }),
    whatsNext: buildWhatsNext(projections),
    bodyComposition: {
      series: buildBodyCompositionSeries(input.records, input.range),
      interventions,
    },
    improvements,
    trends: buildTrendCards({
      records: input.records,
      bloodTests: input.bloodTests,
      nutritionDays: input.nutritionDays,
      range: input.range,
    }),
    correlations: buildCorrelationInsights({
      records: input.records,
      bloodTests: input.bloodTests,
      nutritionDays: input.nutritionDays,
      treatments: input.treatments,
      interventions,
    }),
    interventions,
    achievements,
    projections,
  }
}

export function exportProgressSummary(view: ProgressView): string {
  const payload = {
    exportedAt: new Date().toISOString(),
    range: view.range,
    healthScore: view.healthScore.score,
    change30d: view.healthScore.change30d,
    confidence: view.healthScore.confidence,
    healthStory: view.healthStory,
    causeAndEffect: view.causeAndEffect,
    whatsChanged: view.whatsChanged,
    whatsNext: view.whatsNext,
    trends: view.trends
      .filter((card) => card.available)
      .map((card) => ({
        id: card.id,
        latest: card.latestDisplay,
        change: card.changeDisplay,
        status: card.statusLabel,
      })),
    improvements: view.improvements,
    achievements: view.achievements,
    correlations: view.correlations.map((item) => item.body),
    projections: view.projections.map((item) => ({
      label: item.label,
      target: item.targetDisplay,
      date: item.estimatedDateDisplay,
      confidence: item.confidence,
      note: item.note,
    })),
    interventions: view.interventions.map((item) => ({
      date: item.date,
      label: item.label,
      detail: item.detail,
    })),
  }
  return JSON.stringify(payload, null, 2)
}
