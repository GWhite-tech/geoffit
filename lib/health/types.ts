import type {
  HealthRecord,
  QuantityHealthRecord,
  SleepAnalysisRecord,
  WorkoutHealthRecord,
} from "@/lib/domain/health"

export type MetricPoint = {
  date: string
  value: number
  unit?: string
  id: string
}

export type WeightReading = MetricPoint & {
  unit: string
  record: QuantityHealthRecord
}

export type SleepNight = {
  id: string
  date: string
  durationMinutes: number
  segments: SleepAnalysisRecord[]
}

export type WorkoutSummary = {
  id: string
  date: string
  startDate: string
  endDate: string
  activityType: string
  /** Display title — Hevy name when merged, else activity label. */
  label: string
  durationSeconds: number
  durationMinutes: number
  totalDistanceMeters?: number
  totalEnergyBurnedKcal?: number
  averageHeartRateBpm?: number
  maxHeartRateBpm?: number
  volumeKg?: number
  rpe?: number
  /** Connector labels for UI — e.g. "Apple Health + Hevy". */
  sourcesLabel: string
  sources: Array<{ id: string; label: string }>
  category: string
  hasStructure: boolean
  /** Unified domain workout — prefer this over legacy record. */
  workout: import("@/lib/domain/workout").Workout
  /**
   * @deprecated Raw Apple Health row when the session has a single AH source.
   * Prefer `workout`. Kept for transitional callers.
   */
  record?: WorkoutHealthRecord
}

export type QuantitySeries = {
  type: QuantityHealthRecord["type"]
  points: MetricPoint[]
  latest: MetricPoint | null
}

const ASLEEP_VALUES = new Set([
  "HKCategoryValueSleepAnalysisAsleep",
  "HKCategoryValueSleepAnalysisAsleepCore",
  "HKCategoryValueSleepAnalysisAsleepDeep",
  "HKCategoryValueSleepAnalysisAsleepREM",
  "HKCategoryValueSleepAnalysisAsleepUnspecified",
  // Numeric category values used in some exports
  "1",
  "3",
  "4",
  "5",
])

export function isAsleepSegment(record: SleepAnalysisRecord): boolean {
  const raw = record.sleepValue
  if (ASLEEP_VALUES.has(raw)) return true
  return /Asleep/i.test(raw) && !/InBed|Awake|InBed/i.test(raw)
}

export function toPounds(value: number, unit: string): number {
  const normalized = unit.trim().toLowerCase()
  if (normalized === "kg" || normalized === "kilogram" || normalized === "kilograms") {
    return value * 2.2046226218
  }
  return value
}

export function formatPounds(value: number): string {
  return `${value.toFixed(1)} lb`
}

export function formatDurationMinutes(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(mins / 60)
  const minutes = mins % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`
}

export function workoutActivityLabel(activityType: string): string {
  return activityType
    .replace(/^HKWorkoutActivityType/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim()
}

export function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

export function extractDomainRecordsFromPayload(
  records: Array<{ payload?: Record<string, unknown> }>
): HealthRecord[] {
  const out: HealthRecord[] = []
  for (const record of records) {
    const domain = record.payload?.domain
    if (domain && typeof domain === "object" && "type" in domain) {
      out.push(domain as HealthRecord)
    }
  }
  return out
}
