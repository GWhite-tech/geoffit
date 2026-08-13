import type { HealthMetricType } from "@/lib/domain/health"

/**
 * Sparse body-composition metrics for MC charts.
 * Queried separately so dense HRV/sleep rows cannot crowd them out of a shared limit.
 */
export const MISSION_CONTROL_BODY_METRIC_TYPES: readonly HealthMetricType[] = [
  "body_mass",
  "body_fat_percentage",
  "lean_body_mass",
  "body_mass_index",
  "waist_circumference",
] as const

/**
 * Higher-frequency recovery/performance metrics.
 * Queried with its own bounded limit (PostgREST max_rows is typically 1000).
 */
export const MISSION_CONTROL_RECOVERY_METRIC_TYPES: readonly HealthMetricType[] = [
  "sleep_analysis",
  "heart_rate_variability",
  "resting_heart_rate",
  "vo2_max",
] as const

/** Union of body + recovery — used by local slices and allowlists. */
export const MISSION_CONTROL_HEALTH_METRIC_TYPES: readonly HealthMetricType[] = [
  ...MISSION_CONTROL_BODY_METRIC_TYPES,
  ...MISSION_CONTROL_RECOVERY_METRIC_TYPES,
] as const
