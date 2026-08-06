/**
 * Presentation view-model for Mission Control.
 * Maps existing analytics/hooks — does not fetch or own storage.
 */

import type {
  BloodMarkerTrendCard,
  McTimelineEvent,
  McTimeRange,
  MissionControlView,
  PerformanceCard,
  RecoveryTrendCard,
} from "@/lib/health/analytics"
import type { HealthScoreResult } from "@/lib/health/progress"
import type { NutritionSummary } from "@/lib/health/nutrition"
import type { Profile } from "@/lib/auth/types"

import { buildDailyBriefHeading, type DailyBriefHeading } from "./greeting"

export type MissionControlPriority = {
  id: string
  label: string
  href?: string
}

export type MissionControlMetric = {
  id: string
  label: string
  value: string
  unit?: string | null
  hint?: string | null
  href?: string
}

export type MissionControlNutritionSlice = {
  available: boolean
  caloriesDisplay: string | null
  proteinDisplay: string | null
  proteinAchievement: number | null
  calorieAchievement: number | null
  href: string
}

export type MissionControlViewModel = {
  hasData: boolean
  healthScore: HealthScoreResult
  dailyBrief: DailyBriefHeading & {
    lines: string[]
  }
  priorities: MissionControlPriority[]
  metrics: MissionControlMetric[]
  bloodHighlights: BloodMarkerTrendCard[]
  bodyComposition: MissionControlView["bodyComposition"]
  recovery: RecoveryTrendCard[]
  training: PerformanceCard[]
  nutrition: MissionControlNutritionSlice | null
  timeline: McTimelineEvent[]
  bodyRange: McTimeRange
}

function firstNameFromProfile(profile: Profile | null | undefined): string | null {
  const first = profile?.first_name?.trim()
  if (first) return first
  const display = profile?.display_name?.trim()
  if (display) return display.split(/\s+/)[0] ?? display
  return null
}

function derivePriorities(input: {
  recovery: RecoveryTrendCard[]
  training: PerformanceCard[]
  nutrition: MissionControlNutritionSlice | null
  bloodHighlights: BloodMarkerTrendCard[]
}): MissionControlPriority[] {
  const priorities: MissionControlPriority[] = []

  const sleep = input.recovery.find((card) => /sleep/i.test(card.label))
  if (sleep?.available && sleep.trendDisplay) {
    priorities.push({
      id: "sleep",
      label: `Sleep ${sleep.trendDisplay}`,
      href: "/sleep",
    })
  }

  const training = input.training.find((card) => card.available)
  if (training?.latestDisplay) {
    priorities.push({
      id: "training",
      label: `${training.label}: ${training.latestDisplay}`,
      href: "/training",
    })
  }

  if (
    input.nutrition?.available &&
    input.nutrition.proteinAchievement != null &&
    input.nutrition.proteinAchievement < 90
  ) {
    priorities.push({
      id: "protein",
      label: `Protein at ${Math.round(input.nutrition.proteinAchievement)}% of target`,
      href: "/nutrition",
    })
  } else if (input.nutrition?.available && input.nutrition.proteinDisplay) {
    priorities.push({
      id: "protein",
      label: `Protein today: ${input.nutrition.proteinDisplay}`,
      href: "/nutrition",
    })
  }

  const attention = input.bloodHighlights.find(
    (marker) =>
      marker.available &&
      (marker.statusTone === "high" ||
        marker.statusTone === "low" ||
        marker.statusTone === "attention")
  )
  if (attention) {
    priorities.push({
      id: `blood-${attention.id}`,
      label: `${attention.label} ${attention.statusLabel ?? attention.latestDisplay ?? ""}`.trim(),
      href: attention.href,
    })
  }

  return priorities.slice(0, 4)
}

function deriveMetrics(input: {
  bodyComposition: MissionControlView["bodyComposition"]
  recovery: RecoveryTrendCard[]
  training: PerformanceCard[]
  nutrition: MissionControlNutritionSlice | null
  bloodHighlights: BloodMarkerTrendCard[]
}): MissionControlMetric[] {
  const metrics: MissionControlMetric[] = []

  const weight = input.bodyComposition.series.find((s) => s.id === "weight")
  const weightPoint = weight?.points.at(-1)
  if (weight?.available && weightPoint) {
    metrics.push({
      id: "weight",
      label: "Weight",
      value: weightPoint.value.toFixed(1),
      unit: weight.unit,
      href: "/progress",
    })
  }

  for (const card of input.recovery) {
    if (!card.available || !card.latestDisplay) continue
    metrics.push({
      id: card.id,
      label: card.label,
      value: card.latestDisplay,
      hint: card.trendDisplay,
      href: /sleep/i.test(card.label) ? "/sleep" : "/progress",
    })
  }

  if (input.nutrition?.available && input.nutrition.caloriesDisplay) {
    metrics.push({
      id: "calories",
      label: "Calories",
      value: input.nutrition.caloriesDisplay,
      href: "/nutrition",
    })
  }

  for (const card of input.training) {
    if (!card.available || !card.latestDisplay) continue
    metrics.push({
      id: card.id,
      label: card.label,
      value: card.latestDisplay,
      hint: card.trendDisplay,
      href: "/training",
    })
  }

  const blood = input.bloodHighlights.find((m) => m.available && m.latestDisplay)
  if (blood?.latestDisplay) {
    metrics.push({
      id: `blood-${blood.id}`,
      label: blood.label,
      value: blood.latestDisplay,
      hint: blood.changeDisplay,
      href: blood.href,
    })
  }

  return metrics
}

function briefLines(input: {
  bodyFromAnalytics: string | null | undefined
  healthScore: HealthScoreResult
  hasData: boolean
  weightDeltaLabel: string | null
  sleepDeltaLabel: string | null
}): string[] {
  const lines: string[] = []

  if (input.weightDeltaLabel) lines.push(input.weightDeltaLabel)
  if (input.sleepDeltaLabel) lines.push(input.sleepDeltaLabel)

  const explanation = input.healthScore.explanation?.trim()
  if (explanation) lines.push(explanation)

  const analyticsBody = input.bodyFromAnalytics?.trim()
  if (analyticsBody && !lines.includes(analyticsBody)) {
    lines.push(analyticsBody)
  }

  return lines.slice(0, 4)
}

export function buildMissionControlViewModel(input: {
  mc: MissionControlView
  profile: Profile | null | undefined
  healthScore: HealthScoreResult
  nutritionSummary: NutritionSummary | null | undefined
  bodyRange: McTimeRange
  now?: Date
}): MissionControlViewModel {
  const firstName = firstNameFromProfile(input.profile)
  const heading = buildDailyBriefHeading(firstName, input.now)

  const nutrition: MissionControlNutritionSlice | null = input.nutritionSummary
    ?.today
    ? {
        available: true,
        caloriesDisplay: `${Math.round(input.nutritionSummary.today.calories).toLocaleString("en-GB")} kcal`,
        proteinDisplay: `${Math.round(input.nutritionSummary.today.protein)} g`,
        proteinAchievement: input.nutritionSummary.proteinAchievement,
        calorieAchievement: input.nutritionSummary.calorieAchievement,
        href: "/nutrition",
      }
    : input.nutritionSummary && input.mc.hasData
      ? {
          available: false,
          caloriesDisplay: null,
          proteinDisplay: null,
          proteinAchievement: null,
          calorieAchievement: null,
          href: "/nutrition",
        }
      : null

  const bloodHighlights = input.mc.bloodMarkers.filter((m) => m.available)
  const recovery = input.mc.recovery
  const training = input.mc.performance

  const weightSeries = input.mc.bodyComposition.series.find((s) => s.id === "weight")
  const weightPoints = weightSeries?.points ?? []
  const first = weightPoints[0]?.value
  const last = weightPoints[weightPoints.length - 1]?.value
  const weightDeltaLabel =
    typeof first === "number" &&
    typeof last === "number" &&
    weightPoints.length > 1
      ? last < first
        ? `You've lost ${(first - last).toFixed(1)}${weightSeries?.unit ?? ""} over this range.`
        : last > first
          ? `Weight is up ${(last - first).toFixed(1)}${weightSeries?.unit ?? ""} over this range.`
          : null
      : null

  const sleepCard = recovery.find((card) => /sleep/i.test(card.label))
  const sleepDeltaLabel = sleepCard?.trendDisplay
    ? `Sleep ${sleepCard.trendDisplay}.`
    : null

  // Never surface analytics' hardcoded "Geoff" / default morning greeting in the UI.
  const analyticsBody =
    input.mc.morningBrief.body &&
    !/Geoff/i.test(input.mc.morningBrief.body)
      ? input.mc.morningBrief.body
      : input.mc.morningBrief.body?.replace(/\bGeoff\b/g, firstName ?? "you")

  return {
    hasData: input.mc.hasData,
    healthScore: input.healthScore,
    dailyBrief: {
      ...heading,
      lines: briefLines({
        bodyFromAnalytics: analyticsBody,
        healthScore: input.healthScore,
        hasData: input.mc.hasData,
        weightDeltaLabel,
        sleepDeltaLabel,
      }),
    },
    priorities: derivePriorities({
      recovery,
      training,
      nutrition: nutrition?.available ? nutrition : null,
      bloodHighlights,
    }),
    metrics: deriveMetrics({
      bodyComposition: input.mc.bodyComposition,
      recovery,
      training,
      nutrition: nutrition?.available ? nutrition : null,
      bloodHighlights,
    }),
    bloodHighlights,
    bodyComposition: input.mc.bodyComposition,
    recovery,
    training,
    nutrition,
    timeline: input.mc.timeline,
    bodyRange: input.bodyRange,
  }
}
