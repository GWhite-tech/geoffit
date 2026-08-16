/**
 * Phase 1 coach permission categories ↔ underlying Geoffit data.
 * Single source of truth for app-layer category checks (SQL mirror in migration).
 */

import type { HealthMetricType } from "@/lib/domain/health"

export const COACH_PERMISSION_CATEGORIES = [
  "vitals",
  "sleep",
  "body",
  "nutrition",
  "training",
  "blood",
  "treatments",
] as const

export type CoachPermissionCategory = (typeof COACH_PERMISSION_CATEGORIES)[number]

/**
 * Canonical health_records.metric_type → coach category.
 * Keys are the core HealthMetricType vocabulary; blood-pressure metric
 * strings are handled in coachCategoryForMetric / COACH_EXTRA_VITALS_METRICS
 * so Coach does not require BP product/domain WIP to typecheck.
 */
export const HEALTH_METRIC_COACH_CATEGORY = {
  heart_rate: "vitals",
  resting_heart_rate: "vitals",
  heart_rate_variability: "vitals",
  step_count: "vitals",
  vo2_max: "vitals",
  sleep_analysis: "sleep",
  body_mass: "body",
  body_fat_percentage: "body",
  lean_body_mass: "body",
  body_mass_index: "body",
  waist_circumference: "body",
  height: "body",
  dietary_energy: "nutrition",
  dietary_protein: "nutrition",
  dietary_carbohydrates: "nutrition",
  dietary_fat: "nutrition",
  dietary_fibre: "nutrition",
  dietary_sugar: "nutrition",
  dietary_water: "nutrition",
  dietary_sodium: "nutrition",
  dietary_alcohol: "nutrition",
  dietary_caffeine: "nutrition",
  workout: "training",
} as const satisfies Partial<
  Record<HealthMetricType, CoachPermissionCategory>
>

type CanonicalCoachMetric = keyof typeof HEALTH_METRIC_COACH_CATEGORY

/** Metric strings mapped as vitals even when not yet in HealthMetricType. */
const COACH_EXTRA_VITALS_METRICS = new Set([
  "blood_pressure_systolic",
  "blood_pressure_diastolic",
])

/** Non–health_records tables covered by each category. */
export const COACH_CATEGORY_TABLES: Record<
  CoachPermissionCategory,
  readonly string[]
> = {
  vitals: ["health_records"],
  sleep: ["health_records"],
  body: ["health_records"],
  nutrition: ["health_records", "nutrition_days"],
  training: ["workouts", "health_records"],
  blood: ["blood_panels", "blood_results"],
  treatments: ["treatments", "treatment_lots", "treatment_dose_events"],
}

export function isCoachPermissionCategory(
  value: string
): value is CoachPermissionCategory {
  return (COACH_PERMISSION_CATEGORIES as readonly string[]).includes(value)
}

export function normalizeCoachPermissions(
  permissions: readonly string[]
): CoachPermissionCategory[] | null {
  if (!Array.isArray(permissions) || permissions.length === 0) return null
  const out: CoachPermissionCategory[] = []
  const seen = new Set<CoachPermissionCategory>()
  for (const raw of permissions) {
    if (typeof raw !== "string" || !isCoachPermissionCategory(raw)) return null
    if (!seen.has(raw)) {
      seen.add(raw)
      out.push(raw)
    }
  }
  return out.length > 0 ? out : null
}

export function coachCategoryForMetric(
  metricType: string
): CoachPermissionCategory | null {
  if (COACH_EXTRA_VITALS_METRICS.has(metricType)) return "vitals"
  if (Object.prototype.hasOwnProperty.call(HEALTH_METRIC_COACH_CATEGORY, metricType)) {
    return HEALTH_METRIC_COACH_CATEGORY[metricType as CanonicalCoachMetric]
  }
  return null
}

export function metricTypesForCoachCategory(
  category: CoachPermissionCategory
): string[] {
  const fromCanon = (
    Object.entries(HEALTH_METRIC_COACH_CATEGORY) as Array<
      [CanonicalCoachMetric, CoachPermissionCategory]
    >
  )
    .filter(([, cat]) => cat === category)
    .map(([metric]) => metric)
  if (category === "vitals") {
    return [...fromCanon, ...COACH_EXTRA_VITALS_METRICS]
  }
  return fromCanon
}

export function permissionsInclude(
  granted: readonly CoachPermissionCategory[],
  required: CoachPermissionCategory | readonly CoachPermissionCategory[]
): boolean {
  const need = Array.isArray(required) ? required : [required]
  return need.every((c) => granted.includes(c))
}

export function permissionsIncludeAny(
  granted: readonly CoachPermissionCategory[],
  required: readonly CoachPermissionCategory[]
): boolean {
  return required.some((c) => granted.includes(c))
}
