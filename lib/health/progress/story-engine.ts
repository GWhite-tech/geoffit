import type { BloodTest } from "@/lib/domain/blood"
import type { HealthRecord } from "@/lib/domain/health"
import type { NutritionDay, NutritionTargets } from "@/lib/domain/nutrition"
import {
  bodyFatHistory,
  leanMassHistory,
  waistHistory,
  weightHistory,
} from "@/lib/health/body-composition"
import { buildBiomarkerHistory } from "@/lib/health/blood/biomarker-history"
import { average } from "@/lib/health/statistics"

import {
  addDays,
  dayKey,
  daysForProgressRange,
  filterPointsByProgressRange,
} from "./range"
import {
  recoveryProxyPoints,
  sleepDurationPoints,
} from "./series-builders"
import type {
  HealthStoryChapter,
  InterventionMarker,
  ProgressPoint,
  ProgressRange,
} from "./types"

function monthKey(day: string): string {
  return day.slice(0, 7)
}

function monthLabel(key: string): string {
  const time = Date.parse(`${key}-15T12:00:00.000Z`)
  if (Number.isNaN(time)) return key
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(new Date(time))
}

function pointsInMonth(
  points: ProgressPoint[],
  key: string
): ProgressPoint[] {
  return points.filter((point) => monthKey(point.date) === key)
}

function weeklyRateLb(points: ProgressPoint[]): number | null {
  if (points.length < 2) return null
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  const days =
    (Date.parse(`${last.date}T12:00:00.000Z`) -
      Date.parse(`${first.date}T12:00:00.000Z`)) /
    86_400_000
  if (days < 5) return null
  return ((last.value - first.value) / days) * 7
}

function collectMonthKeys(range: ProgressRange, anchors: string[]): string[] {
  const keys = new Set<string>()
  for (const day of anchors) {
    if (day) keys.add(monthKey(day))
  }

  const days = daysForProgressRange(range)
  const end = dayKey(new Date().toISOString())
  const start = days == null ? addDays(end, -365) : addDays(end, -days)
  let cursor = monthKey(start)
  const endMonth = monthKey(end)
  while (cursor <= endMonth) {
    keys.add(cursor)
    const [y, m] = cursor.split("-").map(Number)
    cursor =
      m === 12
        ? `${y! + 1}-01`
        : `${y}-${String(m! + 1).padStart(2, "0")}`
  }

  return [...keys].sort()
}

/**
 * Build a chronological health narrative from real monthly analytics.
 */
export function buildHealthStory(input: {
  records: HealthRecord[]
  bloodTests: BloodTest[]
  nutritionDays: NutritionDay[]
  nutritionTargets: NutritionTargets
  interventions: InterventionMarker[]
  range: ProgressRange
}): HealthStoryChapter[] {
  const storyRange = input.range === "all" ? "1y" : input.range

  const weights = filterPointsByProgressRange(
    weightHistory(input.records).map((p) => ({
      date: p.date,
      label: p.date,
      value: p.value,
    })),
    storyRange
  )
  const lean = leanMassHistory(input.records).map((p) => ({
    date: p.date,
    label: p.date,
    value: p.value,
  }))
  const waist = waistHistory(input.records).map((p) => ({
    date: p.date,
    label: p.date,
    value: p.value,
  }))
  const bodyFat = bodyFatHistory(input.records).map((p) => ({
    date: p.date,
    label: p.date,
    value: p.value,
  }))
  const sleep = sleepDurationPoints(input.records)
  const recovery = recoveryProxyPoints(input.records)
  const hba1c = buildBiomarkerHistory(input.bloodTests, "hba1c", "all")
  const hbaPts = (hba1c?.points ?? []).map((p) => ({
    date: p.date,
    label: p.dateLabel,
    value: p.value,
  }))

  const nutritionPoints = filterPointsByProgressRange(
    input.nutritionDays.map((day) => ({
      date: day.date,
      label: day.date,
      value: day.protein,
    })),
    storyRange
  )
  const nutritionDaySet = new Set(nutritionPoints.map((p) => p.date))
  const nutritionDaysInRange = input.nutritionDays.filter((day) =>
    nutritionDaySet.has(day.date)
  )

  const anchors = [
    ...weights.map((p) => p.date),
    ...input.interventions.map((i) => i.date),
    ...nutritionDaysInRange.map((d) => d.date),
    ...hbaPts.map((p) => p.date),
  ]
  const months = collectMonthKeys(input.range, anchors)

  const chapters: HealthStoryChapter[] = []
  let previousWeightRate: number | null = null
  let previousRecoveryAvg: number | null = null

  for (let index = 0; index < months.length; index += 1) {
    const key = months[index]!
    const paragraphs: string[] = []

    const monthInterventions = input.interventions.filter(
      (item) =>
        monthKey(item.date) === key &&
        (item.kind === "medication_start" || item.kind === "dose_change")
    )
    for (const marker of monthInterventions) {
      paragraphs.push(`${marker.label}.`)
    }

    const monthWeights = pointsInMonth(weights, key)
    const rate = weeklyRateLb(monthWeights)
    if (rate != null && previousWeightRate != null) {
      const from = Math.abs(previousWeightRate)
      const to = Math.abs(rate)
      if (rate < -0.15 && to > from + 0.3) {
        paragraphs.push(
          `Average weekly weight loss increased from ${from.toFixed(1)} lb/week to ${to.toFixed(1)} lb/week.`
        )
      } else if (rate > 0.15 && previousWeightRate < 0) {
        paragraphs.push(
          `Weight trend slowed — weekly change moved from ${previousWeightRate.toFixed(1)} lb/week to ${rate.toFixed(1)} lb/week.`
        )
      } else if (Math.abs(rate) < 0.15 && Math.abs(previousWeightRate) >= 0.4) {
        paragraphs.push(`Weight loss pace flattened versus the prior month.`)
      }
    } else if (rate != null && rate < -0.4) {
      paragraphs.push(
        `Weight declined at roughly ${Math.abs(rate).toFixed(1)} lb/week.`
      )
    }
    if (rate != null) previousWeightRate = rate

    if (monthWeights.length > 0) {
      const priorWeights = weights.filter((p) => p.date < `${key}-01`)
      const crossed280 =
        monthWeights.some((p) => p.value < 280) &&
        (priorWeights.length === 0 ||
          priorWeights.every((p) => p.value >= 280))
      if (crossed280 && monthWeights.some((p) => p.value < 280)) {
        const everBelowBefore = weights.some(
          (p) => p.date < `${key}-01` && p.value < 280
        )
        if (!everBelowBefore) {
          paragraphs.push(`Weight dropped below 280 lb.`)
        }
      }
    }

    const monthWaist = pointsInMonth(waist, key)
    if (monthWaist.length >= 2) {
      const delta =
        monthWaist[monthWaist.length - 1]!.value - monthWaist[0]!.value
      if (delta <= -2) {
        paragraphs.push(`Waist reduced by ${Math.abs(delta).toFixed(1)} cm.`)
      }
    } else if (monthWaist.length === 1) {
      const prior = waist.filter((p) => p.date < `${key}-01`)
      const lastPrior = prior[prior.length - 1]
      if (lastPrior) {
        const delta = monthWaist[0]!.value - lastPrior.value
        if (delta <= -2) {
          paragraphs.push(`Waist reduced by ${Math.abs(delta).toFixed(1)} cm.`)
        }
      }
    }

    const monthHba = pointsInMonth(hbaPts, key)
    if (monthHba.length > 0) {
      const priorHba = hbaPts.filter((p) => p.date < `${key}-01`)
      const lastPrior = priorHba[priorHba.length - 1]
      const latest = monthHba[monthHba.length - 1]!
      if (lastPrior && latest.value < lastPrior.value - 0.5) {
        paragraphs.push(`HbA1c began falling.`)
      } else if (lastPrior && latest.value > lastPrior.value + 0.5) {
        paragraphs.push(`HbA1c rose versus the previous reading.`)
      } else if (!lastPrior) {
        paragraphs.push(
          `HbA1c recorded at ${latest.value.toFixed(1)} mmol/mol.`
        )
      }
    }

    const monthRecovery = pointsInMonth(recovery, key)
    const recoveryAvg = average(monthRecovery.map((p) => p.value))
    if (recoveryAvg != null) {
      if (previousRecoveryAvg != null) {
        const delta = recoveryAvg - previousRecoveryAvg
        if (Math.abs(delta) < 3) {
          paragraphs.push(`Recovery remained stable.`)
        } else if (delta >= 5) {
          paragraphs.push(`Recovery reached a higher monthly average.`)
        } else if (delta <= -5) {
          paragraphs.push(`Recovery dipped versus the prior month.`)
        }
      }
      const earlierAvgs = months
        .slice(0, index)
        .map((m) => average(pointsInMonth(recovery, m).map((p) => p.value)))
        .filter((v): v is number => v != null)
      if (
        earlierAvgs.length > 0 &&
        recoveryAvg >= Math.max(...earlierAvgs) + 2
      ) {
        paragraphs.push(`Recovery reached its highest monthly average.`)
      }
      previousRecoveryAvg = recoveryAvg
    }

    const monthDays = nutritionDaysInRange.filter(
      (day) => monthKey(day.date) === key
    )
    if (monthDays.length >= 10) {
      const hits = monthDays.filter(
        (day) => day.protein >= input.nutritionTargets.protein * 0.9
      ).length
      if (hits / monthDays.length >= 0.7) {
        paragraphs.push(
          `Protein intake exceeded target on ${hits} of ${monthDays.length} days.`
        )
      }

      const priorKey = index > 0 ? months[index - 1] : null
      const calAvg = average(monthDays.map((d) => d.calories))
      if (priorKey && calAvg != null) {
        const priorMonth = nutritionDaysInRange.filter(
          (day) => monthKey(day.date) === priorKey
        )
        if (priorMonth.length >= 7) {
          const priorAvg = average(priorMonth.map((d) => d.calories))
          if (priorAvg != null && priorAvg - calAvg >= 150) {
            paragraphs.push(
              `Average calories fell by roughly ${Math.round(priorAvg - calAvg)} kcal/day.`
            )
          }
        }
      }
    }

    const monthLean = pointsInMonth(lean, key)
    if (monthLean.length >= 2 && rate != null && rate < -0.3) {
      const leanDelta =
        monthLean[monthLean.length - 1]!.value - monthLean[0]!.value
      if (Math.abs(leanDelta) <= 1.5) {
        paragraphs.push(
          `Lean mass remained stable despite continued weight loss.`
        )
      } else if (leanDelta >= 1.5) {
        paragraphs.push(`Lean mass increased while weight declined.`)
      }
    }

    const monthFat = pointsInMonth(bodyFat, key)
    if (monthFat.length >= 2) {
      const delta =
        monthFat[monthFat.length - 1]!.value - monthFat[0]!.value
      if (delta <= -0.8) {
        paragraphs.push(
          `Body fat decreased by ${Math.abs(delta).toFixed(1)} percentage points.`
        )
      }
    }

    const monthSleep = pointsInMonth(sleep, key)
    if (monthSleep.length >= 10) {
      const avg = average(monthSleep.map((p) => p.value))
      if (avg != null && avg >= 7) {
        paragraphs.push(`Average sleep held at ${avg.toFixed(1)} hours.`)
      } else if (avg != null && avg < 6.2) {
        paragraphs.push(
          `Sleep ran short — averaging ${avg.toFixed(1)} hours.`
        )
      }
    }

    const unique = [...new Set(paragraphs)]
    if (unique.length === 0) continue

    chapters.push({
      id: `story-${key}`,
      monthLabel: monthLabel(key),
      monthKey: key,
      paragraphs: unique,
    })
  }

  return chapters.slice(-8)
}
