import type {
  HealthRecord,
  SleepAnalysisRecord,
} from "@/lib/domain/health"
import { dayKey, formatDurationMinutes } from "@/lib/health/types"
import {
  latestHrv,
  latestRestingHeartRate,
  latestWeight,
  hrvHistory,
  restingHeartRateHistory,
  weightHistory,
} from "@/lib/health/selectors"
import { calculateRecovery } from "@/lib/health/recovery"
import { average } from "@/lib/health/statistics"
import {
  filterByPreferredSource,
  sourceIdentity,
} from "@/lib/health/source-preferences"

import {
  consistencyScoreFromStdDev,
  formatClock,
  intensityFromMinutes,
  sparklineFromValues,
  stdDev,
  DEFAULT_SLEEP_TARGET_MINUTES,
  daysForRange,
  addDaysIso,
} from "./sleep-statistics"
import type {
  SleepHeatmapDay,
  SleepNightDetail,
  SleepStageKind,
  SleepStageSegment,
  SleepTrendPoint,
  SleepTrendRange,
  SleepSignalCard,
} from "./types"

const ASLEEP_KINDS = new Set<SleepStageKind>([
  "deep",
  "core",
  "rem",
  "unspecified",
  "asleep",
])

export function classifySleepStage(sleepValue: string): SleepStageKind {
  const raw = sleepValue
  if (/InBed/i.test(raw) || raw === "0") return "in_bed"
  if (/Awake/i.test(raw) || raw === "2") return "awake"
  if (/AsleepDeep/i.test(raw) || raw === "4") return "deep"
  if (/AsleepREM/i.test(raw) || raw === "5") return "rem"
  if (/AsleepCore/i.test(raw) || raw === "3") return "core"
  if (/AsleepUnspecified/i.test(raw)) return "unspecified"
  if (/Asleep/i.test(raw) || raw === "1") return "asleep"
  return "unknown"
}

export function stageLabel(kind: SleepStageKind): string {
  switch (kind) {
    case "deep":
      return "Deep"
    case "core":
      return "Core"
    case "rem":
      return "REM"
    case "awake":
      return "Awake"
    case "unspecified":
      return "Unspecified"
    case "asleep":
      return "Asleep"
    case "in_bed":
      return "In Bed"
    default:
      return "Unknown"
  }
}

function isAsleepKind(kind: SleepStageKind): boolean {
  return ASLEEP_KINDS.has(kind)
}

function toSegment(record: SleepAnalysisRecord): SleepStageSegment {
  const kind = classifySleepStage(record.sleepValue)
  return {
    id: record.id,
    kind,
    label: stageLabel(kind),
    startDate: record.startDate,
    endDate: record.endDate,
    durationMinutes: record.durationMinutes,
    sourceName: record.sourceName,
  }
}

/**
 * Build nightly sleep sessions from raw Health Store sleep_analysis rows.
 * Prefers configured source (default Withings) before merging stages.
 * Groups by wake-day (endDate). Includes InBed / Awake for efficiency & stages.
 */
export function sleepHistory(records: HealthRecord[]): SleepNightDetail[] {
  const allSleepRecords = records.filter(
    (record): record is SleepAnalysisRecord => record.type === "sleep_analysis"
  )

  const {
    records: sleepRecords,
    preferredSource,
    usedFallback,
  } = filterByPreferredSource(allSleepRecords, "sleep")

  const byNight = new Map<string, SleepAnalysisRecord[]>()
  for (const record of sleepRecords) {
    const key = dayKey(record.endDate || record.startDate)
    if (!key) continue
    const list = byNight.get(key) ?? []
    list.push(record)
    byNight.set(key, list)
  }

  const nights: SleepNightDetail[] = []

  for (const [date, nightRecords] of byNight.entries()) {
    const segments = nightRecords
      .map(toSegment)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))

    const stageTotals = {
      deep: 0,
      core: 0,
      rem: 0,
      awake: 0,
      unspecified: 0,
      asleep: 0,
    }

    let asleepMinutes = 0
    let inBedMinutes = 0

    for (const segment of segments) {
      if (segment.kind === "deep") stageTotals.deep += segment.durationMinutes
      else if (segment.kind === "core")
        stageTotals.core += segment.durationMinutes
      else if (segment.kind === "rem") stageTotals.rem += segment.durationMinutes
      else if (segment.kind === "awake")
        stageTotals.awake += segment.durationMinutes
      else if (segment.kind === "unspecified")
        stageTotals.unspecified += segment.durationMinutes
      else if (segment.kind === "asleep")
        stageTotals.asleep += segment.durationMinutes

      if (isAsleepKind(segment.kind)) {
        asleepMinutes += segment.durationMinutes
      }
      if (segment.kind === "in_bed") {
        inBedMinutes = Math.max(inBedMinutes, segment.durationMinutes)
      }
    }

    // Fallback: if no dedicated InBed, approximate from first→last segment span
    if (inBedMinutes <= 0 && segments.length > 0) {
      const start = Date.parse(segments[0]!.startDate)
      const end = Date.parse(segments[segments.length - 1]!.endDate)
      if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
        inBedMinutes = Math.round((end - start) / 60_000)
      }
    }

    if (asleepMinutes <= 0 && inBedMinutes <= 0) continue

    const asleepSegments = segments.filter((s) => isAsleepKind(s.kind))
    const bedtimeIso =
      segments.find((s) => s.kind === "in_bed")?.startDate ??
      asleepSegments[0]?.startDate ??
      segments[0]?.startDate ??
      null
    const wakeIso =
      segments.filter((s) => s.kind === "in_bed").at(-1)?.endDate ??
      asleepSegments.at(-1)?.endDate ??
      segments.at(-1)?.endDate ??
      null

    const efficiencyPercent =
      inBedMinutes > 0 && asleepMinutes > 0
        ? Math.round(Math.min(100, (asleepMinutes / inBedMinutes) * 100))
        : null

    nights.push({
      id: `sleep-${date}`,
      date,
      bedtimeIso,
      wakeIso,
      asleepMinutes,
      inBedMinutes: inBedMinutes > 0 ? inBedMinutes : null,
      efficiencyPercent,
      stages: segments.filter(
        (s) =>
          s.kind === "deep" ||
          s.kind === "core" ||
          s.kind === "rem" ||
          s.kind === "awake" ||
          s.kind === "unspecified" ||
          s.kind === "asleep"
      ),
      stageTotals,
    })
  }

  const history = nights.sort((a, b) => a.date.localeCompare(b.date))
  const totalSleepDuration = history.reduce(
    (sum, night) => sum + night.asleepMinutes,
    0
  )
  const latestNight = history[history.length - 1]
  const latestSourceUsed = latestNight
    ? sourceIdentity(
        sleepRecords.find((r) => dayKey(r.endDate || r.startDate) === latestNight.date) ??
          sleepRecords[sleepRecords.length - 1]!
      )
    : preferredSource

  console.info("[sleepHistory:module] source filter", {
    totalSleepRecords: allSleepRecords.length,
    recordsAfterSourceFiltering: sleepRecords.length,
    preferredSource,
    usedFallback,
    latestSourceUsed,
    totalSleepDuration,
    nights: history.length,
  })

  return history
}

export function latestSleepNight(
  records: HealthRecord[]
): SleepNightDetail | null {
  const history = sleepHistory(records)
  if (history.length === 0) return null
  return history[history.length - 1]
}

export function averageSleep(
  records: HealthRecord[],
  nights = 7
): number | null {
  const history = sleepHistory(records)
  if (history.length === 0) return null
  const recent = history.slice(-nights)
  return average(recent.map((night) => night.asleepMinutes))
}

export function sleepStages(
  records: HealthRecord[],
  nightDate?: string
): SleepStageSegment[] {
  const history = sleepHistory(records)
  if (history.length === 0) return []
  const night = nightDate
    ? history.find((entry) => entry.date === nightDate)
    : history[history.length - 1]
  return night?.stages ?? []
}

export function sleepEfficiency(
  records: HealthRecord[],
  nightDate?: string
): number | null {
  const history = sleepHistory(records)
  if (history.length === 0) return null
  const night = nightDate
    ? history.find((entry) => entry.date === nightDate)
    : history[history.length - 1]
  return night?.efficiencyPercent ?? null
}

export function sleepConsistency(
  records: HealthRecord[],
  nights = 14
): number | null {
  const history = sleepHistory(records)
  if (history.length < 3) return null
  const recent = history.slice(-nights)
  return consistencyScoreFromStdDev(
    stdDev(recent.map((night) => night.asleepMinutes))
  )
}

export function sleepDurationSparkline(
  records: HealthRecord[],
  nights = 14
): number[] {
  const history = sleepHistory(records)
  return sparklineFromValues(
    history.slice(-nights).map((night) => night.asleepMinutes)
  )
}

export function sleepTrendSeries(
  records: HealthRecord[],
  range: SleepTrendRange,
  targetMinutes = DEFAULT_SLEEP_TARGET_MINUTES
): SleepTrendPoint[] {
  const history = sleepHistory(records)
  if (history.length === 0) return []

  const dayCount = daysForRange(range)
  const endDate = history[history.length - 1]!.date
  const startDate = addDaysIso(endDate, -(dayCount - 1))
  const byDate = new Map(history.map((night) => [night.date, night]))

  const points: SleepTrendPoint[] = []
  for (let i = 0; i < dayCount; i += 1) {
    const date = addDaysIso(startDate, i)
    const night = byDate.get(date)
    if (!night || night.asleepMinutes <= 0) continue

    const windowStart = addDaysIso(date, -6)
    const windowNights = history.filter(
      (entry) => entry.date >= windowStart && entry.date <= date
    )
    const weeklyAverageMinutes = average(
      windowNights.map((entry) => entry.asleepMinutes)
    )

    points.push({
      date,
      label: formatShortDate(date),
      durationMinutes: night.asleepMinutes,
      weeklyAverageMinutes,
      targetMinutes,
    })
  }

  return points
}

export function sleepConsistencyCalendar(
  records: HealthRecord[],
  weeks = 12,
  targetMinutes = DEFAULT_SLEEP_TARGET_MINUTES
): SleepHeatmapDay[] {
  const history = sleepHistory(records)
  const byDate = new Map(history.map((night) => [night.date, night]))

  const end =
    history.length > 0
      ? history[history.length - 1]!.date
      : new Date().toISOString().slice(0, 10)
  const totalDays = weeks * 7
  const start = addDaysIso(end, -(totalDays - 1))

  const days: SleepHeatmapDay[] = []
  for (let i = 0; i < totalDays; i += 1) {
    const date = addDaysIso(start, i)
    const night = byDate.get(date)
    days.push({
      date,
      durationMinutes: night?.asleepMinutes ?? null,
      intensity: intensityFromMinutes(
        night?.asleepMinutes ?? null,
        targetMinutes
      ),
      bedtimeLabel: formatClock(night?.bedtimeIso ?? null),
      wakeLabel: formatClock(night?.wakeIso ?? null),
      durationLabel:
        night && night.asleepMinutes > 0
          ? formatDurationMinutes(night.asleepMinutes)
          : null,
    })
  }

  return days
}

export function recoverySignalCards(records: HealthRecord[]): SleepSignalCard[] {
  const recovery = calculateRecovery(records)
  const rhr = latestRestingHeartRate(records)
  const hrv = latestHrv(records)
  const weight = latestWeight(records)
  const night = latestSleepNight(records)
  const avgSleep = averageSleep(records, 7)

  const rhrSpark = restingHeartRateHistory(records)
    .slice(-14)
    .map((point) => point.value)
  const hrvSpark = hrvHistory(records)
    .slice(-14)
    .map((point) => point.value)
  const weightSpark = weightHistory(records)
    .slice(-14)
    .map((point) => point.value)
  const sleepSpark = sleepDurationSparkline(records, 14)

  return [
    {
      id: "rhr",
      label: "Resting Heart Rate",
      available: rhr != null,
      value: rhr ? `${Math.round(rhr.value)} bpm` : null,
      trend: rhr ? "Latest resting" : null,
      trendDirection: "neutral",
      sparkline: rhrSpark,
      emptyHint:
        "Import Resting Heart Rate from Apple Health to correlate with sleep.",
    },
    {
      id: "hrv",
      label: "HRV",
      available: hrv != null,
      value: hrv ? `${Math.round(hrv.value)} ms` : null,
      trend: hrv ? "Latest SDNN" : null,
      trendDirection: "neutral",
      sparkline: hrvSpark,
      emptyHint:
        "Import Heart Rate Variability (SDNN) from Apple Health to correlate with sleep.",
    },
    {
      id: "sleep",
      label: "Sleep",
      available: night != null && night.asleepMinutes > 0,
      value: night ? formatDurationMinutes(night.asleepMinutes) : null,
      trend:
        avgSleep != null
          ? `avg ${formatDurationMinutes(avgSleep)}`
          : null,
      trendDirection: "neutral",
      sparkline: sleepSpark,
      emptyHint:
        "Import Sleep Analysis from Apple Health. Asleep / Core / Deep / REM stages are required for nightly duration.",
    },
    {
      id: "recovery",
      label: "Recovery",
      available: recovery.score != null,
      value: recovery.score != null ? `${recovery.score}%` : null,
      trend: recovery.score != null ? recovery.label : null,
      trendDirection:
        recovery.score == null
          ? "neutral"
          : recovery.score >= 70
            ? "up"
            : "neutral",
      sparkline: recovery.score != null ? sleepSpark : [],
      emptyHint:
        "Recovery needs sleep plus HRV and/or resting heart rate from Apple Health.",
    },
    {
      id: "weight",
      label: "Weight",
      available: weight != null,
      value: weight ? `${weight.value.toFixed(1)} lb` : null,
      trend: weight ? "Latest reading" : null,
      trendDirection: "neutral",
      sparkline: weightSpark,
      emptyHint: "Import Body Mass from Apple Health to correlate with sleep.",
    },
  ]
}

function formatShortDate(dateKey: string): string {
  const time = Date.parse(`${dateKey}T12:00:00.000Z`)
  if (Number.isNaN(time)) return dateKey
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(time))
}
