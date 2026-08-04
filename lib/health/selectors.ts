import type {
  HealthRecord,
  QuantityHealthRecord,
  SleepAnalysisRecord,
  WorkoutHealthRecord,
} from "@/lib/domain/health"

import {
  dayKey,
  formatDurationMinutes,
  isAsleepSegment,
  toPounds,
  workoutActivityLabel,
  type MetricPoint,
  type SleepNight,
  type WeightReading,
  type WorkoutSummary,
} from "./types"
import { latest, weeklyAverage } from "./statistics"
import {
  filterByPreferredSource,
  sourceIdentity,
} from "./source-preferences"
import { MeasurementMergeEngine } from "./sources"
import {
  displayWorkoutName,
  workoutHistoryFromRecords,
  workoutHasStructure,
  type HevyWorkoutEntry,
} from "./workout"

let lastSourceFilterLogKey = ""
let lastSourceFilterLogAt = 0

function logSleepSourceFilter(payload: Record<string, unknown>) {
  const key = JSON.stringify(payload)
  const now = Date.now()
  if (key === lastSourceFilterLogKey && now - lastSourceFilterLogAt < 2000) {
    return
  }
  lastSourceFilterLogKey = key
  lastSourceFilterLogAt = now
  console.info("[sleepHistory] source filter", payload)
}

function quantityPoints(
  records: HealthRecord[],
  type: QuantityHealthRecord["type"],
  normalize?: (value: number, unit: string) => number
): MetricPoint[] {
  return records
    .filter((record): record is QuantityHealthRecord => record.type === type)
    .map((record) => ({
      id: record.id,
      date: record.startDate,
      value: normalize
        ? normalize(record.value, record.unit)
        : record.value,
      unit: normalize ? "lb" : record.unit,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function weightHistory(records: HealthRecord[]): WeightReading[] {
  const masses = records.filter(
    (record): record is QuantityHealthRecord => record.type === "body_mass"
  )
  const merged = MeasurementMergeEngine.select(masses, "weight")
  return merged
    .map((record) => ({
      id: record.id,
      date: record.startDate,
      value: toPounds(record.value, record.unit),
      unit: "lb" as const,
      record,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function latestWeight(records: HealthRecord[]): WeightReading | null {
  const history = weightHistory(records)
  if (history.length === 0) return null
  return history[history.length - 1]
}

export function bodyMassIndexHistory(records: HealthRecord[]): MetricPoint[] {
  return quantityPoints(records, "body_mass_index")
}

export function latestBodyMassIndex(records: HealthRecord[]): MetricPoint | null {
  return latest(bodyMassIndexHistory(records))
}

export function heartRateHistory(records: HealthRecord[]): MetricPoint[] {
  return quantityPoints(records, "heart_rate")
}

export function restingHeartRateHistory(records: HealthRecord[]): MetricPoint[] {
  return quantityPoints(records, "resting_heart_rate")
}

export function latestRestingHeartRate(
  records: HealthRecord[]
): MetricPoint | null {
  return latest(restingHeartRateHistory(records))
}

export function hrvHistory(records: HealthRecord[]): MetricPoint[] {
  return quantityPoints(records, "heart_rate_variability")
}

export function latestHrv(records: HealthRecord[]): MetricPoint | null {
  return latest(hrvHistory(records))
}

export function vo2History(records: HealthRecord[]): MetricPoint[] {
  return quantityPoints(records, "vo2_max")
}

export function latestVo2(records: HealthRecord[]): MetricPoint | null {
  return latest(vo2History(records))
}

/**
 * Nightly sleep from asleep segments, filtered by preferred source
 * (default: Withings) to avoid multi-device overcount.
 */
export function sleepHistory(records: HealthRecord[]): SleepNight[] {
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
    if (!isAsleepSegment(record)) continue
    // Attribute night to the end date morning bucket
    const key = dayKey(record.endDate || record.startDate)
    const list = byNight.get(key) ?? []
    list.push(record)
    byNight.set(key, list)
  }

  const history = [...byNight.entries()]
    .map(([date, segments]) => {
      const durationMinutes = segments.reduce(
        (sum, segment) => sum + segment.durationMinutes,
        0
      )
      return {
        id: `sleep-${date}`,
        date,
        durationMinutes,
        segments,
      }
    })
    .filter((night) => night.durationMinutes > 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  const totalSleepDuration = history.reduce(
    (sum, night) => sum + night.durationMinutes,
    0
  )
  const latestNight = history[history.length - 1]
  const latestSourceUsed = latestNight
    ? sourceIdentity(latestNight.segments[latestNight.segments.length - 1]!)
    : preferredSource

  logSleepSourceFilter({
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

export function latestSleep(records: HealthRecord[]): SleepNight | null {
  const history = sleepHistory(records)
  if (history.length === 0) return null
  return history[history.length - 1]
}

export function averageSleepMinutes(
  records: HealthRecord[],
  days = 7
): number | null {
  const history = sleepHistory(records)
  if (history.length === 0) return null
  const recent = history.slice(-days)
  const total = recent.reduce((sum, night) => sum + night.durationMinutes, 0)
  return total / recent.length
}

/**
 * Unified workout history — Apple Health + Hevy merged by time overlap.
 * Consumers never see duplicate sessions across connectors.
 */
export function workoutHistory(
  records: HealthRecord[],
  hevyWorkouts: HevyWorkoutEntry[] = []
): WorkoutSummary[] {
  return workoutHistoryFromRecords(records, hevyWorkouts).map((workout) => {
    const appleOnly =
      workout.sources.length === 1 &&
      workout.sources[0]?.id === "apple_health"
        ? records.find(
            (record): record is WorkoutHealthRecord =>
              record.type === "workout" &&
              workout.contributionFingerprints.includes(record.fingerprint)
          )
        : undefined

    return {
      id: workout.id,
      date: dayKey(workout.startDate),
      startDate: workout.startDate,
      endDate: workout.endDate,
      activityType: workout.activityType,
      label: displayWorkoutName(workout),
      durationSeconds: workout.durationSeconds,
      durationMinutes: Math.round(workout.durationSeconds / 60),
      totalDistanceMeters: workout.totalDistanceMeters,
      totalEnergyBurnedKcal: workout.totalEnergyBurnedKcal,
      averageHeartRateBpm: workout.averageHeartRateBpm,
      maxHeartRateBpm: workout.maxHeartRateBpm,
      volumeKg: workout.volumeKg,
      rpe: workout.rpe,
      sourcesLabel: workout.sourcesLabel,
      sources: workout.sources,
      category: workout.category,
      hasStructure: workoutHasStructure(workout),
      workout,
      record: appleOnly,
    }
  })
}

export function latestWorkout(
  records: HealthRecord[],
  hevyWorkouts: HevyWorkoutEntry[] = []
): WorkoutSummary | null {
  const history = workoutHistory(records, hevyWorkouts)
  if (history.length === 0) return null
  return history[history.length - 1]!
}

export function weeklyWeightAverage(records: HealthRecord[]): number | null {
  return weeklyAverage(
    weightHistory(records).map((reading) => ({
      id: reading.id,
      date: reading.date,
      value: reading.value,
      unit: reading.unit,
    }))
  )
}

export function formatSleepNight(night: SleepNight | null): string | null {
  if (!night) return null
  return formatDurationMinutes(night.durationMinutes)
}
