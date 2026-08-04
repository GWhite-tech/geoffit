import type { BloodTest } from "@/lib/domain/blood"
import type { HealthRecord } from "@/lib/domain/health"
import type { HevyWorkoutEntry } from "@/lib/health/workout"

import {
  bodyCompositionHistory,
  pointsFromBodyCompositionHistory,
} from "@/lib/health/body-composition"
import { calculateRecovery, describeSleepDelta } from "@/lib/health/recovery"
import {
  hrvHistory,
  latestHrv,
  latestRestingHeartRate,
  latestSleep,
  latestVo2,
  latestWeight,
  restingHeartRateHistory,
  sleepHistory,
  vo2History,
  weightHistory,
  workoutHistory,
} from "@/lib/health/selectors"
import { difference } from "@/lib/health/statistics"
import {
  formatDurationMinutes,
} from "@/lib/health/types"
import { buildTimeline } from "@/lib/health/timeline"

import { bloodTestTimelineEvents, buildBloodMarkerCards } from "./blood-trends"
import {
  filterPointsByRange,
  formatShortDate,
  sparklineValues,
} from "./series"
import type {
  BodyCompositionSeries,
  McTimeRange,
  MissionControlView,
  McTimelineEvent,
  PerformanceCard,
  RecoveryTrendCard,
  SeriesPoint,
} from "./types"

function greetingForNow(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

/** One short paragraph — longitudinal, not a bullet list. */
function buildMorningBriefParagraph(
  records: HealthRecord[],
  name: string
): MissionControlView["morningBrief"] {
  const greeting = greetingForNow()
  if (records.length === 0) {
    return {
      name,
      greeting,
      body: "Import Apple Health and blood tests to see whether your health is improving over time.",
    }
  }

  const clauses: string[] = []
  const sleep = latestSleep(records)
  const sleepText = sleep ? formatDurationMinutes(sleep.durationMinutes) : null
  const sleepDelta = describeSleepDelta(records)
  if (sleepText && sleepDelta) {
    clauses.push(`you slept ${sleepText} (${sleepDelta})`)
  } else if (sleepText) {
    clauses.push(`you slept ${sleepText}`)
  }

  const weight = latestWeight(records)
  const weights = weightHistory(records)
  if (weight && weights.length >= 2) {
    const previous = weights[weights.length - 2]!
    const delta = difference(weight.value, previous.value)
    if (delta != null && Math.abs(delta) >= 0.1) {
      clauses.push(
        delta < 0
          ? `weight is trending down ${Math.abs(delta).toFixed(1)} lb`
          : `weight is up ${delta.toFixed(1)} lb`
      )
    }
  }

  const recovery = calculateRecovery(records)
  if (recovery.score != null) {
    clauses.push(`recovery sits at ${recovery.score}%`)
  }

  if (clauses.length === 0) {
    return {
      name,
      greeting,
      body: "Your data is connected — trends will sharpen as more nights, weigh-ins, and labs arrive.",
    }
  }

  const body =
    clauses.length === 1
      ? `Looking at your recent trends, ${clauses[0]}.`
      : `Looking at your recent trends, ${clauses.slice(0, -1).join(", ")}, and ${clauses[clauses.length - 1]}.`

  return { name, greeting, body }
}

function seriesFromPoints(
  id: BodyCompositionSeries["id"],
  label: string,
  unit: string,
  color: string,
  points: SeriesPoint[],
  range: McTimeRange,
  emptyHint: string
): BodyCompositionSeries {
  const filtered = filterPointsByRange(points, range)
  const hasMetric = points.length > 0
  return {
    id,
    label,
    unit,
    // Availability is whether the metric exists at all — not whether this
    // window happens to contain a sample (short ranges with sparse weigh-ins).
    available: hasMetric,
    emptyHint: !hasMetric
      ? emptyHint
      : filtered.length === 0
        ? "No readings in this time period."
        : null,
    points: filtered,
    color,
  }
}

function buildBodyComposition(
  records: HealthRecord[],
  range: McTimeRange
): MissionControlView["bodyComposition"] {
  const toSeriesPoints = (
    points: Array<{ date: string; value: number }>
  ): SeriesPoint[] =>
    points.map((point) => ({
      date: point.date.slice(0, 10),
      label: formatShortDate(point.date),
      value: Number(point.value.toFixed(2)),
    }))

  // Merge sessions once — each *History() helper used to re-merge the full set.
  const sessions = bodyCompositionHistory(records)
  const leanPoints = toSeriesPoints(
    pointsFromBodyCompositionHistory(
      sessions,
      (session) => session.leanBodyMass,
      "lb"
    )
  )

  return {
    range,
    series: [
      seriesFromPoints(
        "weight",
        "Weight",
        "lb",
        "var(--primary)",
        toSeriesPoints(
          pointsFromBodyCompositionHistory(
            sessions,
            (session) => session.weight,
            "lb"
          )
        ),
        range,
        "Import Body Mass from Apple Health to chart weight."
      ),
      seriesFromPoints(
        "body_fat",
        "Body Fat %",
        "%",
        "var(--chart-2)",
        toSeriesPoints(
          pointsFromBodyCompositionHistory(
            sessions,
            (session) => session.bodyFatPercentage,
            "%"
          )
        ),
        range,
        "Import Body Fat Percentage from Apple Health (e.g. Withings)."
      ),
      seriesFromPoints(
        "lean_body_mass",
        "Lean Body Mass",
        "lb",
        "var(--chart-3)",
        leanPoints,
        range,
        "Import Lean Body Mass from Apple Health."
      ),
      seriesFromPoints(
        "muscle_mass",
        "Muscle Mass",
        "lb",
        "#34D399",
        leanPoints,
        range,
        "Import Lean Body Mass from Apple Health (used as muscle mass)."
      ),
      seriesFromPoints(
        "bmi",
        "BMI",
        "",
        "#A78BFA",
        toSeriesPoints(
          pointsFromBodyCompositionHistory(
            sessions,
            (session) => session.bodyMassIndex,
            "count"
          )
        ),
        range,
        "Import Body Mass Index from Apple Health."
      ),
      seriesFromPoints(
        "waist",
        "Waist",
        "cm",
        "#FBBF24",
        toSeriesPoints(
          pointsFromBodyCompositionHistory(
            sessions,
            (session) => session.waistCircumference,
            "cm"
          )
        ),
        range,
        "Import Waist Circumference from Apple Health."
      ),
    ],
  }
}

function buildRecoveryCards(records: HealthRecord[]): RecoveryTrendCard[] {
  const sleepNights = sleepHistory(records)
  const sleepSpark = sleepNights.slice(-14).map((n) => n.durationMinutes)
  const latestSleepNight = sleepNights[sleepNights.length - 1]
  const avg7 =
    sleepNights.length > 0
      ? sleepNights.slice(-7).reduce((s, n) => s + n.durationMinutes, 0) /
        Math.min(7, sleepNights.length)
      : null

  const hrvPoints = hrvHistory(records)
  const hrv = latestHrv(records)
  const rhrPoints = restingHeartRateHistory(records)
  const rhr = latestRestingHeartRate(records)
  const recovery = calculateRecovery(records)

  // Recovery score isn't stored historically — approximate with recent sleep spark as proxy trend shape when score exists
  const recoverySpark =
    recovery.score != null
      ? sleepSpark.map((minutes) =>
          Math.round(Math.min(100, (minutes / (7.5 * 60)) * 100))
        )
      : []

  return [
    {
      id: "sleep",
      label: "Sleep",
      available: latestSleepNight != null,
      latestDisplay: latestSleepNight
        ? formatDurationMinutes(latestSleepNight.durationMinutes)
        : null,
      trendDisplay:
        avg7 != null ? `avg ${formatDurationMinutes(avg7)}` : null,
      sparkline: sleepSpark,
      emptyHint: "Import Sleep Analysis from Apple Health.",
    },
    {
      id: "hrv",
      label: "HRV",
      available: hrv != null,
      latestDisplay: hrv ? `${Math.round(hrv.value)} ms` : null,
      trendDisplay: hrv ? "Latest SDNN" : null,
      sparkline: sparklineValues(
        hrvPoints.map((p) => ({
          date: p.date.slice(0, 10),
          label: formatShortDate(p.date),
          value: p.value,
        }))
      ),
      emptyHint: "Import Heart Rate Variability (SDNN) from Apple Health.",
    },
    {
      id: "rhr",
      label: "Resting HR",
      available: rhr != null,
      latestDisplay: rhr ? `${Math.round(rhr.value)} bpm` : null,
      trendDisplay: rhr ? "Latest resting" : null,
      sparkline: sparklineValues(
        rhrPoints.map((p) => ({
          date: p.date.slice(0, 10),
          label: formatShortDate(p.date),
          value: p.value,
        }))
      ),
      emptyHint: "Import Resting Heart Rate from Apple Health.",
    },
    {
      id: "recovery",
      label: "Recovery",
      available: recovery.score != null,
      latestDisplay: recovery.score != null ? `${recovery.score}%` : null,
      trendDisplay: recovery.score != null ? recovery.label : null,
      sparkline: recoverySpark,
      emptyHint: "Recovery needs sleep plus HRV and/or resting HR.",
    },
  ]
}

function buildPerformanceCards(
  records: HealthRecord[],
  hevyWorkouts: HevyWorkoutEntry[] = []
): PerformanceCard[] {
  const workouts = workoutHistory(records, hevyWorkouts)
  const vo2 = latestVo2(records)
  const vo2Points = vo2History(records)

  const last30 = workouts.filter((w) => {
    const time = Date.parse(w.startDate)
    return !Number.isNaN(time) && Date.now() - time <= 30 * 86_400_000
  })
  const frequency = last30.length
  const loadMinutes = last30.reduce((sum, w) => sum + w.durationMinutes, 0)

  // Strength analytics — structured lifting only (Hevy ownership).
  const strengthSessions = last30.filter((w) => w.hasStructure)
  const latestStrength = [...workouts].reverse().find((w) => w.hasStructure)
  const strengthVolume = strengthSessions.reduce(
    (sum, w) => sum + (w.volumeKg ?? 0),
    0
  )
  const strengthSpark = (() => {
    const buckets = new Map<string, number>()
    for (const w of workouts.filter((session) => session.hasStructure).slice(-60)) {
      buckets.set(
        w.date,
        (buckets.get(w.date) ?? 0) + (w.volumeKg ?? w.durationMinutes)
      )
    }
    return [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([, value]) => value)
  })()

  // Cardio load — physiology-backed sessions (Apple Health ownership).
  const cardioSessions = last30.filter(
    (w) => w.category !== "strength" || !w.hasStructure
  )
  const cardioMinutes = cardioSessions.reduce(
    (sum, w) => sum + w.durationMinutes,
    0
  )

  const frequencySpark = (() => {
    const buckets = new Map<string, number>()
    for (const w of workouts.slice(-60)) {
      buckets.set(w.date, (buckets.get(w.date) ?? 0) + 1)
    }
    return [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([, count]) => count)
  })()
  const loadSpark = (() => {
    const buckets = new Map<string, number>()
    for (const w of workouts.slice(-60)) {
      buckets.set(w.date, (buckets.get(w.date) ?? 0) + w.durationMinutes)
    }
    return [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([, mins]) => mins)
  })()

  return [
    {
      id: "strength",
      label: "Strength",
      available: latestStrength != null,
      latestDisplay: latestStrength
        ? latestStrength.volumeKg != null
          ? `${Math.round(latestStrength.volumeKg)} kg`
          : latestStrength.label
        : null,
      trendDisplay: latestStrength
        ? strengthVolume > 0
          ? `${Math.round(strengthVolume)} kg · 30d`
          : `${strengthSessions.length} sessions · 30d`
        : null,
      sparkline: strengthSpark,
      emptyHint: "Connect Hevy for structured strength logging.",
    },
    {
      id: "vo2",
      label: "VO₂ Max",
      available: vo2 != null,
      latestDisplay: vo2 ? `${vo2.value.toFixed(1)}` : null,
      trendDisplay: vo2 ? "mL/kg·min" : null,
      sparkline: sparklineValues(
        vo2Points.map((p) => ({
          date: p.date.slice(0, 10),
          label: formatShortDate(p.date),
          value: p.value,
        }))
      ),
      emptyHint: "Import VO₂ Max from Apple Health.",
    },
    {
      id: "training_load",
      label: "Training Load",
      available: workouts.length > 0,
      latestDisplay: workouts.length > 0 ? `${loadMinutes} min` : null,
      trendDisplay:
        workouts.length > 0
          ? cardioMinutes > 0
            ? `${cardioMinutes} min cardio · 30d`
            : "Last 30 days"
          : null,
      sparkline: loadSpark,
      emptyHint: "Import workouts to track training load.",
    },
    {
      id: "frequency",
      label: "Workout Frequency",
      available: workouts.length > 0,
      latestDisplay: workouts.length > 0 ? `${frequency}` : null,
      trendDisplay: workouts.length > 0 ? "Sessions · 30d" : null,
      sparkline: frequencySpark,
      emptyHint: "Import workouts to track frequency.",
    },
  ]
}

function buildMcTimeline(
  records: HealthRecord[],
  tests: BloodTest[],
  treatmentEvents: McTimelineEvent[] = []
): McTimelineEvent[] {
  const healthEvents = buildTimeline(records, { limit: 40 }).map((event) => {
    const kind: McTimelineEvent["kind"] =
      event.kind === "workout"
        ? "workout"
        : event.kind === "weight" || event.kind === "body_composition"
          ? "weight"
          : event.kind === "sleep"
            ? "sleep"
            : event.kind === "recovery"
              ? "recovery"
              : "measurement"

    return {
      id: event.id,
      kind,
      dateLabel: event.dateLabel,
      time: event.time,
      title: event.title,
      detail: event.detail,
      sortKey: event.sortKey,
    } satisfies McTimelineEvent
  })

  const bloodEvents: McTimelineEvent[] = bloodTestTimelineEvents(tests)

  // Import signal: if we have any health records, surface a single import marker from earliest record
  const importEvents: McTimelineEvent[] = []
  if (records.length > 0) {
    const earliest = [...records].sort((a, b) =>
      a.startDate.localeCompare(b.startDate)
    )[0]
    if (earliest) {
      importEvents.push({
        id: "apple-health-import",
        kind: "import",
        dateLabel: formatShortDate(earliest.startDate),
        time: "",
        title: "Apple Health data",
        detail: `${records.length.toLocaleString()} records in Health Store`,
        sortKey: earliest.startDate,
      })
    }
  }

  return [...healthEvents, ...bloodEvents, ...importEvents, ...treatmentEvents]
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    .slice(0, 48)
}

/**
 * Analytics Engine — projects Health Store + Blood Store + Treatment Store
 * into Mission Control.
 */
export function buildMissionControlView(
  healthRecords: HealthRecord[],
  bloodTests: BloodTest[],
  options: {
    name?: string
    bodyRange?: McTimeRange
    treatmentTimeline?: McTimelineEvent[]
    hevyWorkouts?: HevyWorkoutEntry[]
  } = {}
): MissionControlView {
  const name = options.name ?? "Geoff"
  const bodyRange = options.bodyRange ?? "90d"
  const hevyWorkouts = options.hevyWorkouts ?? []
  const hasData =
    healthRecords.length > 0 ||
    bloodTests.length > 0 ||
    hevyWorkouts.length > 0 ||
    (options.treatmentTimeline?.length ?? 0) > 0

  return {
    hasData,
    morningBrief: buildMorningBriefParagraph(healthRecords, name),
    bodyComposition: buildBodyComposition(healthRecords, bodyRange),
    bloodMarkers: buildBloodMarkerCards(bloodTests),
    recovery: buildRecoveryCards(healthRecords),
    performance: buildPerformanceCards(healthRecords, hevyWorkouts),
    timeline: buildMcTimeline(
      healthRecords,
      bloodTests,
      options.treatmentTimeline
    ),
  }
}

export function rebuildBodyCompositionOnly(
  healthRecords: HealthRecord[],
  range: McTimeRange
): MissionControlView["bodyComposition"] {
  return buildBodyComposition(healthRecords, range)
}
