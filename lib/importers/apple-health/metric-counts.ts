import type { HealthMetricType } from "@/lib/domain/health"

import {
  APPLE_HEALTH_RECORD_TYPES,
  APPLE_HEALTH_WORKOUT_TYPE,
  classifyHealthKitType,
  friendlyHealthKitTypeName,
  isHealthKitTypeIdentifier,
  type HealthKitTypeClassification,
} from "./constants"
import type { AppleHealthTypeCount } from "./types"
import type { SupportedMetricCounts } from "./progress"

const HK_TYPE_TO_METRIC: Record<string, HealthMetricType> = {
  [APPLE_HEALTH_RECORD_TYPES.BODY_MASS]: "body_mass",
  [APPLE_HEALTH_RECORD_TYPES.BODY_FAT_PERCENTAGE]: "body_fat_percentage",
  [APPLE_HEALTH_RECORD_TYPES.LEAN_BODY_MASS]: "lean_body_mass",
  [APPLE_HEALTH_RECORD_TYPES.BODY_MASS_INDEX]: "body_mass_index",
  [APPLE_HEALTH_RECORD_TYPES.WAIST_CIRCUMFERENCE]: "waist_circumference",
  [APPLE_HEALTH_RECORD_TYPES.HEIGHT]: "height",
  [APPLE_HEALTH_RECORD_TYPES.SLEEP_ANALYSIS]: "sleep_analysis",
  [APPLE_HEALTH_RECORD_TYPES.HEART_RATE]: "heart_rate",
  [APPLE_HEALTH_RECORD_TYPES.RESTING_HEART_RATE]: "resting_heart_rate",
  [APPLE_HEALTH_RECORD_TYPES.HRV_SDNN]: "heart_rate_variability",
  [APPLE_HEALTH_RECORD_TYPES.VO2_MAX]: "vo2_max",
  [APPLE_HEALTH_WORKOUT_TYPE]: "workout",
  [APPLE_HEALTH_RECORD_TYPES.STEP_COUNT]: "step_count",
  [APPLE_HEALTH_RECORD_TYPES.DIETARY_ENERGY]: "dietary_energy",
  [APPLE_HEALTH_RECORD_TYPES.DIETARY_PROTEIN]: "dietary_protein",
  [APPLE_HEALTH_RECORD_TYPES.DIETARY_CARBOHYDRATES]: "dietary_carbohydrates",
  [APPLE_HEALTH_RECORD_TYPES.DIETARY_FAT]: "dietary_fat",
  [APPLE_HEALTH_RECORD_TYPES.DIETARY_FIBRE]: "dietary_fibre",
  [APPLE_HEALTH_RECORD_TYPES.DIETARY_SUGAR]: "dietary_sugar",
  [APPLE_HEALTH_RECORD_TYPES.DIETARY_WATER]: "dietary_water",
  [APPLE_HEALTH_RECORD_TYPES.DIETARY_SODIUM]: "dietary_sodium",
  [APPLE_HEALTH_RECORD_TYPES.DIETARY_ALCOHOL]: "dietary_alcohol",
  [APPLE_HEALTH_RECORD_TYPES.DIETARY_CAFFEINE]: "dietary_caffeine",
}

export function metricTypeForHkType(
  hkType: string | undefined
): HealthMetricType | null {
  if (!hkType) return null
  return HK_TYPE_TO_METRIC[hkType] ?? null
}

export function incrementMetric(
  metrics: SupportedMetricCounts,
  key: HealthMetricType
): void {
  metrics[key] += 1
}

export function sumMetrics(metrics: SupportedMetricCounts): number {
  let total = 0
  for (const value of Object.values(metrics)) total += value
  return total
}

export interface ClassifiedTypeCount extends AppleHealthTypeCount {
  label: string
  classification: HealthKitTypeClassification
}

export function classifyTypeCounts(
  counts: Map<string, number> | AppleHealthTypeCount[],
  enabledHkTypes?: Set<string>,
  profileKnownHkTypes?: Set<string>
): {
  supported: ClassifiedTypeCount[]
  disabled: ClassifiedTypeCount[]
  ignored: ClassifiedTypeCount[]
  unknown: ClassifiedTypeCount[]
  detected: ClassifiedTypeCount[]
  appleHealthDetected: boolean
} {
  const entries: AppleHealthTypeCount[] = Array.isArray(counts)
    ? counts
    : [...counts.entries()].map(([type, count]) => ({ type, count }))

  const classified: ClassifiedTypeCount[] = entries
    .map((entry) => ({
      ...entry,
      label: friendlyHealthKitTypeName(entry.type),
      classification: classifyHealthKitType(
        entry.type,
        enabledHkTypes,
        profileKnownHkTypes
      ),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

  const supported = classified.filter((e) => e.classification === "supported")
  const disabled = classified.filter((e) => e.classification === "disabled")
  const ignored = classified.filter((e) => e.classification === "ignored")
  const unknown = classified.filter((e) => e.classification === "unknown")
  const detected = classified.filter((e) => isHealthKitTypeIdentifier(e.type))

  return {
    supported,
    disabled,
    ignored,
    unknown,
    detected,
    appleHealthDetected: detected.length > 0,
  }
}
