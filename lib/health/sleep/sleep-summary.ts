import type { HealthRecord } from "@/lib/domain/health"
import { formatDurationMinutes } from "@/lib/health/types"

import {
  averageSleep,
  latestSleepNight,
  recoverySignalCards,
  sleepConsistency,
  sleepConsistencyCalendar,
  sleepDurationSparkline,
  sleepEfficiency,
  sleepHistory,
  sleepTrendSeries,
} from "./sleep-selectors"
import {
  DEFAULT_SLEEP_TARGET_MINUTES,
  formatSignedMinutes,
} from "./sleep-statistics"
import type {
  ComingSoonMetric,
  FutureSleepSignalSlot,
  SleepMetric,
  SleepSummary,
  SleepTrendRange,
} from "./types"

function comingSoon(reason: string): ComingSoonMetric {
  return {
    available: false,
    value: null,
    display: "Coming soon",
    reason,
  }
}

function minutesMetric(
  minutes: number | null,
  options: {
    trend?: string | null
    trendDirection?: "up" | "down" | "neutral"
    sparkline?: number[]
    comingSoonReason: string
  }
): SleepMetric<number> {
  if (minutes == null || minutes <= 0) {
    return comingSoon(options.comingSoonReason)
  }
  return {
    available: true,
    value: minutes,
    display: formatDurationMinutes(minutes),
    trend: options.trend,
    trendDirection: options.trendDirection ?? "neutral",
    sparkline: options.sparkline,
  }
}

function percentMetric(
  value: number | null,
  options: {
    trend?: string | null
    sparkline?: number[]
    comingSoonReason: string
  }
): SleepMetric<number> {
  if (value == null) {
    return comingSoon(options.comingSoonReason)
  }
  return {
    available: true,
    value,
    display: `${Math.round(value)}%`,
    trend: options.trend,
    trendDirection: "neutral",
    sparkline: options.sparkline,
  }
}

function scoreMetric(
  value: number | null,
  options: {
    trend?: string | null
    sparkline?: number[]
    comingSoonReason: string
  }
): SleepMetric<number> {
  if (value == null) {
    return comingSoon(options.comingSoonReason)
  }
  return {
    available: true,
    value,
    display: String(Math.round(value)),
    trend: options.trend,
    trendDirection: "neutral",
    sparkline: options.sparkline,
  }
}

const FUTURE_SIGNALS: FutureSleepSignalSlot[] = [
  {
    id: "sleep_apnoea",
    label: "Sleep Apnoea",
    available: false,
    reason: "Awaiting dedicated sleep disorder import signals.",
  },
  {
    id: "snoring",
    label: "Snoring",
    available: false,
    reason: "Awaiting audio / wearable snoring events.",
  },
  {
    id: "cpap",
    label: "CPAP usage",
    available: false,
    reason: "Awaiting CPAP / therapy device integrations.",
  },
  {
    id: "temperature",
    label: "Temperature",
    available: false,
    reason: "Import wrist temperature when available from Apple Health.",
  },
  {
    id: "respiratory_rate",
    label: "Respiratory Rate",
    available: false,
    reason: "Import Respiratory Rate from Apple Health.",
  },
  {
    id: "blood_oxygen",
    label: "Blood Oxygen",
    available: false,
    reason: "Import Blood Oxygen (SpO₂) from Apple Health.",
  },
  {
    id: "caffeine",
    label: "Caffeine",
    available: false,
    reason: "Awaiting nutrition / habit logging.",
  },
  {
    id: "alcohol",
    label: "Alcohol",
    available: false,
    reason: "Awaiting nutrition / habit logging.",
  },
  {
    id: "medication",
    label: "Medication",
    available: false,
    reason: "Awaiting medication tracking.",
  },
]

function buildAiBrief(records: HealthRecord[]): SleepSummary["aiBrief"] {
  const history = sleepHistory(records)
  if (history.length < 3) {
    return {
      paragraphs: [],
      emptyHint:
        "Import several nights of Sleep Analysis from Apple Health to unlock your AI Sleep Brief.",
    }
  }

  const paragraphs: string[] = []
  const latest = history[history.length - 1]!
  const last14 = history.slice(-14)
  const prev14 = history.slice(-28, -14)
  const avg14 = averageSleep(records, 14)
  const avgPrev =
    prev14.length > 0
      ? prev14.reduce((sum, n) => sum + n.asleepMinutes, 0) / prev14.length
      : null

  if (avg14 != null && avgPrev != null) {
    const delta = Math.round(avg14 - avgPrev)
    if (Math.abs(delta) >= 10) {
      const abs = formatDurationMinutes(Math.abs(delta))
      paragraphs.push(
        delta > 0
          ? `Your average sleep duration has increased by ${abs} over the past two weeks.`
          : `Your average sleep duration has decreased by ${abs} over the past two weeks.`
      )
    } else {
      paragraphs.push(
        `Your average sleep duration has remained steady over the past two weeks at around ${formatDurationMinutes(avg14)}.`
      )
    }
  } else if (avg14 != null) {
    paragraphs.push(
      `Your recent average sleep is ${formatDurationMinutes(avg14)} across the last ${Math.min(14, last14.length)} nights.`
    )
  }

  const deepRecent = last14.reduce((sum, n) => sum + n.stageTotals.deep, 0)
  const deepPrev = prev14.reduce((sum, n) => sum + n.stageTotals.deep, 0)
  if (last14.some((n) => n.stageTotals.deep > 0)) {
    if (prev14.length >= 3 && deepPrev > 0) {
      const recentAvg = deepRecent / last14.length
      const prevAvg = deepPrev / prev14.length
      const delta = recentAvg - prevAvg
      if (Math.abs(delta) < 8) {
        paragraphs.push("Deep sleep has remained stable.")
      } else if (delta > 0) {
        paragraphs.push(
          `Deep sleep has increased by about ${formatDurationMinutes(Math.round(delta))} per night versus the prior fortnight.`
        )
      } else {
        paragraphs.push(
          `Deep sleep has eased by about ${formatDurationMinutes(Math.round(Math.abs(delta)))} per night versus the prior fortnight.`
        )
      }
    } else {
      paragraphs.push(
        `Last night included ${formatDurationMinutes(latest.stageTotals.deep)} of deep sleep.`
      )
    }
  }

  const consistency = sleepConsistency(records, 14)
  if (consistency != null && consistency >= 70) {
    paragraphs.push(
      "Recovery signals tend to improve alongside your increased sleep consistency."
    )
  } else if (consistency != null && consistency < 55) {
    paragraphs.push(
      "Sleep duration has been less consistent lately — steadier bed and wake times usually lift recovery."
    )
  }

  const bedtimes = last14
    .map((n) => n.bedtimeIso)
    .filter((iso): iso is string => Boolean(iso))
    .map((iso) => {
      const d = new Date(iso)
      let mins = d.getHours() * 60 + d.getMinutes()
      // Treat late nights: map early morning bedtimes after midnight as +24h for drift calc
      if (mins < 12 * 60) mins += 24 * 60
      return mins
    })

  const month = history.slice(-30)
  const monthBeds = month
    .map((n) => n.bedtimeIso)
    .filter((iso): iso is string => Boolean(iso))
    .map((iso) => {
      const d = new Date(iso)
      let mins = d.getHours() * 60 + d.getMinutes()
      if (mins < 12 * 60) mins += 24 * 60
      return mins
    })

  if (monthBeds.length >= 8) {
    const firstHalf = monthBeds.slice(0, Math.floor(monthBeds.length / 2))
    const secondHalf = monthBeds.slice(Math.floor(monthBeds.length / 2))
    const avg = (values: number[]) =>
      values.reduce((a, b) => a + b, 0) / values.length
    const drift = Math.round(avg(secondHalf) - avg(firstHalf))
    if (Math.abs(drift) >= 20) {
      const abs = formatDurationMinutes(Math.abs(drift))
      paragraphs.push(
        drift > 0
          ? `Your average bedtime has drifted ${abs} later over the last month.`
          : `Your average bedtime has shifted ${abs} earlier over the last month.`
      )
    }
  } else if (bedtimes.length >= 5) {
    const first = bedtimes.slice(0, Math.floor(bedtimes.length / 2))
    const second = bedtimes.slice(Math.floor(bedtimes.length / 2))
    if (first.length > 0 && second.length > 0) {
      const avg = (values: number[]) =>
        values.reduce((a, b) => a + b, 0) / values.length
      const drift = Math.round(avg(second) - avg(first))
      if (Math.abs(drift) >= 25) {
        const abs = formatDurationMinutes(Math.abs(drift))
        paragraphs.push(
          drift > 0
            ? `Your bedtime has recently drifted about ${abs} later.`
            : `Your bedtime has recently shifted about ${abs} earlier.`
        )
      }
    }
  }

  if (paragraphs.length === 0) {
    return {
      paragraphs: [
        `Last night you slept ${formatDurationMinutes(latest.asleepMinutes)}. Keep importing nights to deepen this brief.`,
      ],
      emptyHint: null,
    }
  }

  return { paragraphs, emptyHint: null }
}

export function generateSleepSummary(
  records: HealthRecord[],
  options: {
    trendRange?: SleepTrendRange
    targetMinutes?: number
  } = {}
): SleepSummary {
  const trendRange = options.trendRange ?? "30d"
  const targetMinutes = options.targetMinutes ?? DEFAULT_SLEEP_TARGET_MINUTES

  const history = sleepHistory(records)
  const latest = latestSleepNight(records)
  const hasData = history.some((night) => night.asleepMinutes > 0)

  if (!hasData) {
    return {
      hasData: false,
      emptyState: {
        title: "No sleep data yet",
        description:
          "Import an Apple Health export with Sleep Analysis records. Geoffit needs Asleep, Core, Deep, or REM stages to build your nightly sleep view.",
      },
      overview: {
        lastNight: comingSoon(
          "Import Sleep Analysis (Asleep / Core / Deep / REM) from Apple Health."
        ),
        versusWeeklyAverage: null,
        sleepScore: comingSoon(
          "Sleep Score will unlock once Geoffit has a calibrated scoring model on your data."
        ),
        timeInBed: comingSoon(
          "Import Sleep Analysis In Bed intervals from Apple Health."
        ),
        sleepEfficiency: comingSoon(
          "Needs both asleep stages and In Bed intervals from Apple Health."
        ),
        consistency: comingSoon(
          "Consistency needs several nights of Sleep Analysis."
        ),
      },
      stages: {
        nightDate: null,
        segments: [],
        totals: {
          deep: comingSoon("Needs Deep sleep stages from Apple Health."),
          core: comingSoon("Needs Core sleep stages from Apple Health."),
          rem: comingSoon("Needs REM sleep stages from Apple Health."),
          awake: comingSoon("Needs Awake intervals from Apple Health."),
        },
        emptyHint:
          "Stage timelines appear after Apple Health Sleep Analysis stages are imported.",
      },
      trend: {
        range: trendRange,
        points: [],
        targetMinutes,
      },
      consistencyCalendar: {
        days: [],
        emptyHint:
          "A consistency heatmap appears once multiple nights of sleep are available.",
      },
      recoverySignals: recoverySignalCards(records),
      futureSignals: FUTURE_SIGNALS,
      aiBrief: {
        paragraphs: [],
        emptyHint:
          "Your AI Sleep Brief will appear after several nights of Sleep Analysis are imported.",
      },
    }
  }

  const weeklyAvg = averageSleep(records, 7)
  const versusWeeklyAverage =
    latest && weeklyAvg != null
      ? formatSignedMinutes(latest.asleepMinutes - weeklyAvg)
      : null

  const durationSpark = sleepDurationSparkline(records, 14)
  const efficiency = sleepEfficiency(records)
  const consistency = sleepConsistency(records, 14)
  const inBed = latest?.inBedMinutes ?? null

  const stageNight = latest
  const hasStageBreakdown =
    !!stageNight &&
    (stageNight.stageTotals.deep > 0 ||
      stageNight.stageTotals.core > 0 ||
      stageNight.stageTotals.rem > 0 ||
      stageNight.stageTotals.awake > 0 ||
      stageNight.stageTotals.asleep > 0)

  return {
    hasData: true,
    emptyState: null,
    overview: {
      lastNight: minutesMetric(latest?.asleepMinutes ?? null, {
        trend: versusWeeklyAverage,
        trendDirection:
          latest && weeklyAvg != null
            ? latest.asleepMinutes >= weeklyAvg
              ? "up"
              : "down"
            : "neutral",
        sparkline: durationSpark,
        comingSoonReason:
          "Import Sleep Analysis (Asleep / Core / Deep / REM) from Apple Health.",
      }),
      versusWeeklyAverage,
      sleepScore: comingSoon(
        "Sleep Score will unlock once Geoffit has a calibrated scoring model on your data."
      ),
      timeInBed: minutesMetric(inBed, {
        trend: inBed != null ? "Last night" : null,
        sparkline: history
          .slice(-14)
          .map((n) => n.inBedMinutes ?? 0)
          .filter((v) => v > 0),
        comingSoonReason:
          "Import Sleep Analysis In Bed intervals from Apple Health.",
      }),
      sleepEfficiency: percentMetric(efficiency, {
        trend: efficiency != null ? "Last night" : null,
        comingSoonReason:
          "Needs both asleep stages and In Bed intervals from Apple Health.",
      }),
      consistency: scoreMetric(consistency, {
        trend: consistency != null ? "14-night rhythm" : null,
        sparkline: durationSpark,
        comingSoonReason:
          "Consistency needs at least three nights of Sleep Analysis.",
      }),
    },
    stages: {
      nightDate: stageNight?.date ?? null,
      segments: hasStageBreakdown ? stageNight!.stages : [],
      totals: {
        deep: minutesMetric(
          hasStageBreakdown ? stageNight!.stageTotals.deep : null,
          {
            comingSoonReason: "Needs Deep sleep stages from Apple Health.",
          }
        ),
        core: minutesMetric(
          hasStageBreakdown
            ? stageNight!.stageTotals.core + stageNight!.stageTotals.asleep
            : null,
          {
            comingSoonReason: "Needs Core sleep stages from Apple Health.",
          }
        ),
        rem: minutesMetric(
          hasStageBreakdown ? stageNight!.stageTotals.rem : null,
          {
            comingSoonReason: "Needs REM sleep stages from Apple Health.",
          }
        ),
        awake: minutesMetric(
          hasStageBreakdown ? stageNight!.stageTotals.awake : null,
          {
            comingSoonReason: "Needs Awake intervals from Apple Health.",
          }
        ),
      },
      emptyHint: hasStageBreakdown
        ? null
        : "Stage detail needs Core, Deep, REM, or Awake samples from Apple Health Sleep Analysis.",
    },
    trend: {
      range: trendRange,
      points: sleepTrendSeries(records, trendRange, targetMinutes),
      targetMinutes,
    },
    consistencyCalendar: {
      days: sleepConsistencyCalendar(records, 12, targetMinutes),
      emptyHint: null,
    },
    recoverySignals: recoverySignalCards(records),
    futureSignals: FUTURE_SIGNALS,
    aiBrief: buildAiBrief(records),
  }
}
