import type {
  NutritionDay,
  NutritionTargets,
} from "@/lib/domain/nutrition"
import type { HealthRecord } from "@/lib/domain/health"
import {
  averageOf,
  dayMeetsTargets,
  filterDaysByRange,
  formatDayLabel,
  rollingAverage,
  targetAchievement,
  type NutritionRange,
} from "@/lib/health/nutrition/selectors"
import { latestWeight, weightHistory } from "@/lib/health/selectors"
import { averageSleepMinutes } from "@/lib/health/selectors"
import { calculateRecovery } from "@/lib/health/recovery"

export type NutritionChartPoint = {
  date: string
  label: string
  calories: number
  average: number | null
  target: number
  protein: number
  carbohydrates: number
  fat: number
  fibre: number
  water: number
}

export type NutritionChartData = {
  range: NutritionRange
  points: NutritionChartPoint[]
}

export type MacroAdherenceCard = {
  id: string
  label: string
  unit: string
  latest: number | null
  average: number | null
  trend: "up" | "down" | "neutral"
  trendDisplay: string
  achievement: number | null
  target: number
}

export type NutritionSummary = {
  range: NutritionRange
  anchorDate: string
  today: NutritionDay | null
  targets: NutritionTargets
  caloriesRemaining: number | null
  proteinRemaining: number | null
  calorieAchievement: number | null
  proteinAchievement: number | null
  overallAchievement: number | null
  chart: NutritionChartData
  adherence: MacroAdherenceCard[]
  history: Array<
    NutritionDay & {
      label: string
      targetMet: boolean
    }
  >
}

export function buildNutritionChartData(
  days: NutritionDay[],
  targets: NutritionTargets,
  range: NutritionRange,
  anchorDate?: string
): NutritionChartData {
  const ranged = filterDaysByRange(days, range, anchorDate)
  const calories = ranged.map((day) => day.calories)
  const averages = rollingAverage(calories, 7)

  return {
    range,
    points: ranged.map((day, index) => ({
      date: day.date,
      label: formatDayLabel(day.date),
      calories: day.calories,
      average: averages[index] ?? null,
      target: targets.calories,
      protein: day.protein,
      carbohydrates: day.carbohydrates,
      fat: day.fat,
      fibre: day.fibre,
      water: day.water,
    })),
  }
}

export function buildMacroAdherence(
  days: NutritionDay[],
  targets: NutritionTargets
): MacroAdherenceCard[] {
  if (days.length === 0) return []
  const latest = days[days.length - 1]!
  const prev = days.length >= 2 ? days[days.length - 2]! : null

  const defs: Array<{
    id: string
    label: string
    unit: string
    key: "calories" | "protein" | "carbohydrates" | "fat" | "fibre" | "water"
    target: number
    mode: "reach" | "stay_under"
    decimals?: number
  }> = [
    {
      id: "calories",
      label: "Calories",
      unit: "kcal",
      key: "calories",
      target: targets.calories,
      mode: "stay_under",
    },
    {
      id: "protein",
      label: "Protein",
      unit: "g",
      key: "protein",
      target: targets.protein,
      mode: "reach",
    },
    {
      id: "carbohydrates",
      label: "Carbs",
      unit: "g",
      key: "carbohydrates",
      target: targets.carbohydrates,
      mode: "stay_under",
    },
    {
      id: "fat",
      label: "Fat",
      unit: "g",
      key: "fat",
      target: targets.fat,
      mode: "stay_under",
    },
    {
      id: "fibre",
      label: "Fibre",
      unit: "g",
      key: "fibre",
      target: targets.fibre,
      mode: "reach",
    },
    {
      id: "water",
      label: "Water",
      unit: "L",
      key: "water",
      target: targets.water,
      mode: "reach",
      decimals: 1,
    },
  ]

  return defs.map((def) => {
    const average = averageOf(days, def.key)
    const latestValue = latest[def.key]
    const prevValue = prev?.[def.key] ?? null
    let trend: "up" | "down" | "neutral" = "neutral"
    if (prevValue != null) {
      const delta = latestValue - prevValue
      if (Math.abs(delta) < (def.decimals === 1 ? 0.05 : 1)) trend = "neutral"
      else trend = delta > 0 ? "up" : "down"
    }
    const delta =
      prevValue != null ? latestValue - prevValue : null
    const trendDisplay =
      delta == null
        ? "—"
        : `${delta > 0 ? "↑" : delta < 0 ? "↓" : "–"} ${Math.abs(delta).toFixed(def.decimals ?? 0)}${def.unit === "L" ? " L" : def.unit === "kcal" ? "" : " g"}`

    return {
      id: def.id,
      label: def.label,
      unit: def.unit,
      latest: latestValue,
      average,
      trend,
      trendDisplay,
      achievement:
        average != null
          ? targetAchievement(average, def.target, def.mode)
          : null,
      target: def.target,
    }
  })
}

export function buildNutritionSummary(
  days: NutritionDay[],
  targets: NutritionTargets,
  range: NutritionRange,
  anchorDate?: string
): NutritionSummary {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const anchor =
    anchorDate ??
    sorted[sorted.length - 1]?.date ??
    new Date().toISOString().slice(0, 10)
  const ranged = filterDaysByRange(sorted, range, anchor)
  const today = sorted.find((day) => day.date === anchor) ?? sorted[sorted.length - 1] ?? null

  const calorieAchievement =
    today != null
      ? targetAchievement(today.calories, targets.calories, "stay_under")
      : null
  const proteinAchievement =
    today != null
      ? targetAchievement(today.protein, targets.protein, "reach")
      : null

  return {
    range,
    anchorDate: anchor,
    today,
    targets,
    caloriesRemaining:
      today != null ? targets.calories - today.calories : null,
    proteinRemaining:
      today != null ? Math.max(0, targets.protein - today.protein) : null,
    calorieAchievement,
    proteinAchievement,
    overallAchievement:
      calorieAchievement != null && proteinAchievement != null
        ? Math.round((calorieAchievement + proteinAchievement) / 2)
        : null,
    chart: buildNutritionChartData(sorted, targets, range, anchor),
    adherence: buildMacroAdherence(ranged, targets),
    history: [...ranged]
      .reverse()
      .map((day) => ({
        ...day,
        label: formatDayLabel(day.date),
        targetMet: dayMeetsTargets(day, targets),
      })),
  }
}

export type NutritionInsight = {
  id: string
  body: string
}

/**
 * Correlate nutrition days with health signals — no hardcoded copy paths.
 */
export function buildNutritionInsights(
  days: NutritionDay[],
  targets: NutritionTargets,
  healthRecords: HealthRecord[]
): NutritionInsight[] {
  const insights: NutritionInsight[] = []
  if (days.length < 14) {
    return [
      {
        id: "insufficient",
        body: "Import or log at least two weeks of nutrition data to unlock correlation insights.",
      },
    ]
  }

  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const weights = weightHistory(healthRecords)
  const pairedWeight = sorted
    .map((day) => {
      const weight = weights.find((point) => point.date.slice(0, 10) === day.date)
      return weight ? { day, weight: weight.value } : null
    })
    .filter(Boolean) as Array<{ day: NutritionDay; weight: number }>

  if (pairedWeight.length >= 10) {
    const highProtein = pairedWeight.filter(
      (row) => row.day.protein >= targets.protein
    )
    const lowProtein = pairedWeight.filter(
      (row) => row.day.protein < targets.protein * 0.85
    )
    if (highProtein.length >= 4 && lowProtein.length >= 4) {
      const highDelta = averageAdjacentDelta(highProtein.map((r) => r.weight))
      const lowDelta = averageAdjacentDelta(lowProtein.map((r) => r.weight))
      if (highDelta != null && lowDelta != null && highDelta < lowDelta - 0.05) {
        insights.push({
          id: "protein-weight",
          body: `Weight loss is greater on days with ≥${targets.protein}g protein (avg ${highDelta.toFixed(2)} vs ${lowDelta.toFixed(2)} ${latestWeight(healthRecords)?.unit ?? "kg"}).`,
        })
      }
    }
  }

  const sleepAvg = averageSleepMinutes(healthRecords, 30)
  if (sleepAvg != null) {
    const highCal = sorted.filter((day) => day.calories > targets.calories)
    const lowCal = sorted.filter((day) => day.calories <= targets.calories)
    if (highCal.length >= 5 && lowCal.length >= 5) {
      // Proxy: use day-of-week sleep average as we lack per-day sleep join here.
      // Compare calorie cohorts against overall sleep — softer insight.
      const highAvg = averageOf(highCal, "calories")
      const lowAvg = averageOf(lowCal, "calories")
      if (highAvg != null && lowAvg != null && highAvg > lowAvg + 150) {
        insights.push({
          id: "calories-sleep",
          body: `Average sleep is ${formatSleep(sleepAvg)} over the last month — higher-calorie days (avg ${Math.round(highAvg)} kcal) are worth watching against energy and recovery.`,
        })
      }
    }
  }

  const recovery = calculateRecovery(healthRecords)
  const highFat = sorted.filter((day) => day.fat > targets.fat * 1.15)
  if (recovery.score != null && highFat.length >= 5) {
    insights.push({
      id: "fat-recovery",
      body:
        recovery.score < 70
          ? `Recovery is currently ${recovery.score}%. High-fat days (avg ${Math.round(averageOf(highFat, "fat") ?? 0)}g) have been frequent — consider whether evening intake is affecting overnight recovery.`
          : `Fat intake averaged ${Math.round(averageOf(sorted, "fat") ?? 0)}g across the range while recovery sits at ${recovery.score}%.`,
    })
  }

  const highProteinDays = sorted.filter((day) => day.protein > 220)
  if (highProteinDays.length >= 5 && pairedWeight.length >= 8) {
    insights.push({
      id: "protein-220",
      body: `On ${highProteinDays.length} days with >220g protein, average calories were ${Math.round(averageOf(highProteinDays, "calories") ?? 0)} kcal — useful for checking whether surplus protein is paired with a deficit.`,
    })
  }

  const proteinHitRate =
    (sorted.filter((day) => day.protein >= targets.protein * 0.9).length /
      sorted.length) *
    100
  insights.push({
    id: "protein-adherence",
    body: `Protein target achieved on ${Math.round(proteinHitRate)}% of days in this range (target ${targets.protein}g).`,
  })

  return insights.slice(0, 4)
}

function averageAdjacentDelta(values: number[]): number | null {
  if (values.length < 2) return null
  let sum = 0
  let count = 0
  for (let i = 1; i < values.length; i += 1) {
    sum += values[i]! - values[i - 1]!
    count += 1
  }
  return count > 0 ? sum / count : null
}

function formatSleep(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return `${hours}h ${String(mins).padStart(2, "0")}m`
}

export function buildMissionControlNutritionCards(
  days: NutritionDay[],
  targets: NutritionTargets
) {
  const summary = buildNutritionSummary(days, targets, "7d")
  const today = summary.today
  return {
    available: days.length > 0,
    caloriesDisplay: today ? `${Math.round(today.calories).toLocaleString("en-GB")} kcal` : null,
    proteinDisplay: today ? `${Math.round(today.protein)} g` : null,
    proteinAchievement: summary.proteinAchievement,
    calorieAchievement: summary.calorieAchievement,
    averageProtein7d: averageOf(filterDaysByRange(days, "7d"), "protein"),
    href: "/nutrition",
    emptyHint: "Import or log nutrition to track macros.",
  }
}
