/** Geoffit health domain models — importer output maps here before persistence. */

export type HealthMetricType =
  | "body_mass"
  | "body_fat_percentage"
  | "lean_body_mass"
  | "body_mass_index"
  | "waist_circumference"
  | "height"
  | "sleep_analysis"
  | "heart_rate"
  | "resting_heart_rate"
  | "heart_rate_variability"
  | "vo2_max"
  | "workout"
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

export type DietaryHealthMetricType =
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

export const DIETARY_HEALTH_METRIC_TYPES: readonly DietaryHealthMetricType[] = [
  "dietary_energy",
  "dietary_protein",
  "dietary_carbohydrates",
  "dietary_fat",
  "dietary_fibre",
  "dietary_sugar",
  "dietary_water",
  "dietary_sodium",
  "dietary_alcohol",
  "dietary_caffeine",
] as const

export interface HealthRecordBase {
  id: string
  type: HealthMetricType
  source: string
  /** Human-readable Apple Health sourceName (e.g. "Withings", "Geoff’s Apple Watch"). */
  sourceName?: string
  /** HealthKit source bundle id when present on the export. */
  sourceBundleIdentifier?: string
  /** Raw HealthKit device attribute string (often an HKDevice dump). */
  device?: string
  /** Friendly device name when known (e.g. "Apple Watch"). */
  deviceName?: string
  startDate: string
  endDate: string
  creationDate?: string
  /** Stable fingerprint for duplicate detection within an import batch. */
  fingerprint: string
}

export interface QuantityHealthRecord extends HealthRecordBase {
  type:
    | "body_mass"
    | "body_fat_percentage"
    | "lean_body_mass"
    | "body_mass_index"
    | "waist_circumference"
    | "height"
    | "heart_rate"
    | "resting_heart_rate"
    | "heart_rate_variability"
    | "vo2_max"
    | "step_count"
    | DietaryHealthMetricType
  value: number
  unit: string
  rawType: string
}

export interface SleepAnalysisRecord extends HealthRecordBase {
  type: "sleep_analysis"
  sleepValue: string
  durationMinutes: number
  rawType: string
}

export interface WorkoutHealthRecord extends HealthRecordBase {
  type: "workout"
  activityType: string
  durationSeconds: number
  totalDistanceMeters?: number
  totalEnergyBurnedKcal?: number
}

export type HealthRecord =
  | QuantityHealthRecord
  | SleepAnalysisRecord
  | WorkoutHealthRecord

export const HEALTH_METRIC_LABELS: Record<HealthMetricType, string> = {
  body_mass: "Body Mass",
  body_fat_percentage: "Body Fat Percentage",
  lean_body_mass: "Lean Body Mass",
  body_mass_index: "Body Mass Index",
  waist_circumference: "Waist Circumference",
  height: "Height",
  sleep_analysis: "Sleep Analysis",
  heart_rate: "Heart Rate",
  resting_heart_rate: "Resting Heart Rate",
  heart_rate_variability: "Heart Rate Variability (SDNN)",
  vo2_max: "VO₂ Max",
  workout: "Workout",
  step_count: "Step Count",
  dietary_energy: "Dietary Energy",
  dietary_protein: "Dietary Protein",
  dietary_carbohydrates: "Dietary Carbohydrates",
  dietary_fat: "Dietary Fat",
  dietary_fibre: "Dietary Fibre",
  dietary_sugar: "Dietary Sugar",
  dietary_water: "Dietary Water",
  dietary_sodium: "Dietary Sodium",
  dietary_alcohol: "Alcoholic Beverages",
  dietary_caffeine: "Dietary Caffeine",
}

export const HEALTH_METRIC_CATEGORIES: Record<HealthMetricType, string> = {
  body_mass: "Body",
  body_fat_percentage: "Body",
  lean_body_mass: "Body",
  body_mass_index: "Body",
  waist_circumference: "Body",
  height: "Body",
  sleep_analysis: "Sleep",
  heart_rate: "Recovery",
  resting_heart_rate: "Recovery",
  heart_rate_variability: "Recovery",
  vo2_max: "Fitness",
  workout: "Activity",
  step_count: "Activity",
  dietary_energy: "Nutrition",
  dietary_protein: "Nutrition",
  dietary_carbohydrates: "Nutrition",
  dietary_fat: "Nutrition",
  dietary_fibre: "Nutrition",
  dietary_sugar: "Nutrition",
  dietary_water: "Nutrition",
  dietary_sodium: "Nutrition",
  dietary_alcohol: "Nutrition",
  dietary_caffeine: "Nutrition",
}

export function isDietaryHealthMetric(
  type: HealthMetricType
): type is DietaryHealthMetricType {
  return (DIETARY_HEALTH_METRIC_TYPES as readonly string[]).includes(type)
}
