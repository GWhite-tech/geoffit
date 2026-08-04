import type { HealthMetricType } from "@/lib/domain/health"

import {
  APPLE_HEALTH_RECORD_TYPES,
  APPLE_HEALTH_WORKOUT_TYPE,
} from "./constants"

/**
 * Profile metric IDs — includes importable domain metrics and known
 * high-volume HealthKit types that are skipped by default.
 */
export type ImportProfileMetricId =
  | "body_mass"
  | "body_fat_percentage"
  | "lean_body_mass"
  | "body_mass_index"
  | "waist_circumference"
  | "height"
  | "sleep_analysis"
  | "resting_heart_rate"
  | "heart_rate_variability"
  | "vo2_max"
  | "workout"
  | "heart_rate"
  | "step_count"
  | "dietary_energy"
  | "dietary_protein"
  | "dietary_carbohydrates"
  | "dietary_fat"
  | "dietary_fibre"
  | "dietary_sugar"
  | "dietary_water"
  | "dietary_sodium"
  | "dietary_alcohol"
  | "dietary_caffeine"
  | "active_energy"
  | "walking_speed"
  | "ecg"
  | "cycling_power"
  | "running_power"

export interface ImportProfileMetricDefinition {
  id: ImportProfileMetricId
  label: string
  /** HealthKit type identifiers that map to this profile toggle. */
  hkTypes: readonly string[]
  defaultEnabled: boolean
  /** Domain model key when Geoffit can import this type. */
  domainType?: HealthMetricType
}

export const IMPORT_PROFILE_METRICS: readonly ImportProfileMetricDefinition[] = [
  {
    id: "body_mass",
    label: "Body Mass",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.BODY_MASS],
    defaultEnabled: true,
    domainType: "body_mass",
  },
  {
    id: "body_fat_percentage",
    label: "Body Fat %",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.BODY_FAT_PERCENTAGE],
    defaultEnabled: true,
    domainType: "body_fat_percentage",
  },
  {
    id: "lean_body_mass",
    label: "Lean Body Mass",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.LEAN_BODY_MASS],
    defaultEnabled: true,
    domainType: "lean_body_mass",
  },
  {
    id: "body_mass_index",
    label: "Body Mass Index",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.BODY_MASS_INDEX],
    defaultEnabled: true,
    domainType: "body_mass_index",
  },
  {
    id: "waist_circumference",
    label: "Waist Circumference",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.WAIST_CIRCUMFERENCE],
    defaultEnabled: true,
    domainType: "waist_circumference",
  },
  {
    id: "height",
    label: "Height",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.HEIGHT],
    defaultEnabled: true,
    domainType: "height",
  },
  {
    id: "sleep_analysis",
    label: "Sleep",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.SLEEP_ANALYSIS],
    defaultEnabled: true,
    domainType: "sleep_analysis",
  },
  {
    id: "resting_heart_rate",
    label: "Resting Heart Rate",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.RESTING_HEART_RATE],
    defaultEnabled: true,
    domainType: "resting_heart_rate",
  },
  {
    id: "heart_rate_variability",
    label: "HRV",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.HRV_SDNN],
    defaultEnabled: true,
    domainType: "heart_rate_variability",
  },
  {
    id: "vo2_max",
    label: "VO₂ Max",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.VO2_MAX],
    defaultEnabled: true,
    domainType: "vo2_max",
  },
  {
    id: "workout",
    label: "Workouts",
    hkTypes: [APPLE_HEALTH_WORKOUT_TYPE],
    defaultEnabled: true,
    domainType: "workout",
  },
  {
    id: "heart_rate",
    label: "Heart Rate",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.HEART_RATE],
    defaultEnabled: false,
    domainType: "heart_rate",
  },
  {
    id: "step_count",
    label: "Step Count",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.STEP_COUNT],
    defaultEnabled: true,
    domainType: "step_count",
  },
  {
    id: "dietary_energy",
    label: "Dietary Energy",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.DIETARY_ENERGY],
    defaultEnabled: true,
    domainType: "dietary_energy",
  },
  {
    id: "dietary_protein",
    label: "Dietary Protein",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.DIETARY_PROTEIN],
    defaultEnabled: true,
    domainType: "dietary_protein",
  },
  {
    id: "dietary_carbohydrates",
    label: "Carbohydrates",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.DIETARY_CARBOHYDRATES],
    defaultEnabled: true,
    domainType: "dietary_carbohydrates",
  },
  {
    id: "dietary_fat",
    label: "Dietary Fat",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.DIETARY_FAT],
    defaultEnabled: true,
    domainType: "dietary_fat",
  },
  {
    id: "dietary_fibre",
    label: "Dietary Fibre",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.DIETARY_FIBRE],
    defaultEnabled: true,
    domainType: "dietary_fibre",
  },
  {
    id: "dietary_sugar",
    label: "Dietary Sugar",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.DIETARY_SUGAR],
    defaultEnabled: true,
    domainType: "dietary_sugar",
  },
  {
    id: "dietary_water",
    label: "Dietary Water",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.DIETARY_WATER],
    defaultEnabled: true,
    domainType: "dietary_water",
  },
  {
    id: "dietary_sodium",
    label: "Dietary Sodium",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.DIETARY_SODIUM],
    defaultEnabled: true,
    domainType: "dietary_sodium",
  },
  {
    id: "dietary_alcohol",
    label: "Alcohol",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.DIETARY_ALCOHOL],
    defaultEnabled: true,
    domainType: "dietary_alcohol",
  },
  {
    id: "dietary_caffeine",
    label: "Caffeine",
    hkTypes: [APPLE_HEALTH_RECORD_TYPES.DIETARY_CAFFEINE],
    defaultEnabled: true,
    domainType: "dietary_caffeine",
  },
  {
    id: "active_energy",
    label: "Active Energy",
    hkTypes: ["HKQuantityTypeIdentifierActiveEnergyBurned"],
    defaultEnabled: false,
  },
  {
    id: "walking_speed",
    label: "Walking Speed",
    hkTypes: ["HKQuantityTypeIdentifierWalkingSpeed"],
    defaultEnabled: false,
  },
  {
    id: "ecg",
    label: "ECG",
    hkTypes: [
      "HKDataTypeIdentifierElectrocardiogram",
      "HKDataTypeIdentifierECGVoltageMeasurement",
    ],
    defaultEnabled: false,
  },
  {
    id: "cycling_power",
    label: "Cycling Power",
    hkTypes: ["HKQuantityTypeIdentifierCyclingPower"],
    defaultEnabled: false,
  },
  {
    id: "running_power",
    label: "Running Power",
    hkTypes: ["HKQuantityTypeIdentifierRunningPower"],
    defaultEnabled: false,
  },
] as const

export type ImportProfileToggles = Record<ImportProfileMetricId, boolean>

export function createDefaultImportProfile(): ImportProfileToggles {
  const toggles = {} as ImportProfileToggles
  for (const metric of IMPORT_PROFILE_METRICS) {
    toggles[metric.id] = metric.defaultEnabled
  }
  return toggles
}

export function getEnabledProfileMetrics(
  profile: ImportProfileToggles
): ImportProfileMetricDefinition[] {
  return IMPORT_PROFILE_METRICS.filter((metric) => profile[metric.id])
}

export function getDisabledProfileMetrics(
  profile: ImportProfileToggles
): ImportProfileMetricDefinition[] {
  return IMPORT_PROFILE_METRICS.filter((metric) => !profile[metric.id])
}

/** Set of HealthKit type strings that should be fully parsed. */
export function buildEnabledHkTypeSet(
  profile: ImportProfileToggles
): Set<string> {
  const enabled = new Set<string>()
  for (const metric of IMPORT_PROFILE_METRICS) {
    if (!profile[metric.id] || !metric.domainType) continue
    for (const hkType of metric.hkTypes) {
      enabled.add(hkType)
    }
  }
  return enabled
}

/** Map HK type → profile metric for skip / reduction accounting. */
export function buildHkTypeToProfileMetric(): Map<
  string,
  ImportProfileMetricDefinition
> {
  const map = new Map<string, ImportProfileMetricDefinition>()
  for (const metric of IMPORT_PROFILE_METRICS) {
    for (const hkType of metric.hkTypes) {
      map.set(hkType, metric)
    }
  }
  return map
}

export interface ProfileSkipStat {
  id: ImportProfileMetricId
  label: string
  count: number
}

export interface ImportReductionEstimate {
  /** Records matching profile metrics that are disabled. */
  skippedByProfile: number
  /** Records fully parsed (enabled). */
  enabledParsed: number
  /** Estimated % of import work avoided by the current profile. */
  estimatedReductionPercent: number | null
  /** Highest-volume disabled metrics for UI messaging. */
  topSkipped: ProfileSkipStat[]
}

export function estimateImportReduction(
  skippedCounts: Map<ImportProfileMetricId, number>,
  enabledParsed: number
): ImportReductionEstimate {
  const topSkipped: ProfileSkipStat[] = []
  let skippedByProfile = 0

  for (const metric of IMPORT_PROFILE_METRICS) {
    const count = skippedCounts.get(metric.id) ?? 0
    if (count <= 0) continue
    skippedByProfile += count
    topSkipped.push({ id: metric.id, label: metric.label, count })
  }

  topSkipped.sort((a, b) => b.count - a.count)

  const totalRelevant = skippedByProfile + enabledParsed
  const estimatedReductionPercent =
    totalRelevant > 0
      ? Math.min(
          99,
          Math.round((skippedByProfile / totalRelevant) * 100)
        )
      : null

  return {
    skippedByProfile,
    enabledParsed,
    estimatedReductionPercent,
    topSkipped: topSkipped.slice(0, 3),
  }
}

export const DEFAULT_IMPORT_PROFILE = createDefaultImportProfile()
