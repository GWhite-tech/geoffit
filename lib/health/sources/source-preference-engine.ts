/**
 * SourcePreferenceEngine — metric-specific source policies.
 * Not a global priority list: each metric declares its own mode.
 */

import type { HealthMetricType, HealthRecordBase } from "@/lib/domain/health"
import {
  matchesSourcePreference,
  parseDeviceName,
  resolveDeviceName,
  sourceIdentity,
} from "./source-match"

export type SourcePolicyMode =
  /** Keep preferred source only; fall back to all if none match. */
  | "prefer_primary"
  /** Keep every reading; near-duplicates resolve to primary when present. */
  | "merge_all"
  /** No source filtering or preference-based dedupe. */
  | "unrestricted"

export type SourcePreferenceMetricId =
  | "sleep"
  | "weight"
  | "body_fat"
  | "lean_mass"
  | "muscle_mass"
  | "bmi"
  | "waist"
  | "hrv"
  | "resting_heart_rate"
  | "heart_rate"
  | "steps"
  | "nutrition"
  | HealthMetricType

export type MetricSourcePolicy = {
  metric: SourcePreferenceMetricId
  mode: SourcePolicyMode
  /** Preferred device/source label (soft-matched). */
  primary?: string
  /** Documented fallback — used only for prefer_primary empty matches. */
  fallback?: string
  /** Duplicate window for merge_all (default 5 minutes). */
  duplicateWindowMs?: number
}

export const DEFAULT_DUPLICATE_WINDOW_MS = 5 * 60 * 1000

/**
 * Metric-specific defaults.
 * ONLY sleep prefers Withings as a hard filter.
 * Weight merges all sources and uses Withings only to break near-duplicates.
 */
const DEFAULT_POLICIES: MetricSourcePolicy[] = [
  {
    metric: "sleep",
    mode: "prefer_primary",
    primary: "Withings",
    fallback: "Apple Health",
  },
  {
    metric: "sleep_analysis",
    mode: "prefer_primary",
    primary: "Withings",
    fallback: "Apple Health",
  },
  {
    metric: "weight",
    mode: "merge_all",
    primary: "Withings",
    fallback: "Apple Health",
    duplicateWindowMs: DEFAULT_DUPLICATE_WINDOW_MS,
  },
  {
    metric: "body_mass",
    mode: "merge_all",
    primary: "Withings",
    fallback: "Apple Health",
    duplicateWindowMs: DEFAULT_DUPLICATE_WINDOW_MS,
  },
  {
    metric: "body_fat",
    mode: "unrestricted",
  },
  {
    metric: "body_fat_percentage",
    mode: "unrestricted",
  },
  {
    metric: "lean_mass",
    mode: "unrestricted",
  },
  {
    metric: "lean_body_mass",
    mode: "unrestricted",
  },
  {
    metric: "muscle_mass",
    mode: "unrestricted",
  },
  {
    metric: "bmi",
    mode: "unrestricted",
  },
  {
    metric: "body_mass_index",
    mode: "unrestricted",
  },
  {
    metric: "waist",
    mode: "unrestricted",
  },
  {
    metric: "waist_circumference",
    mode: "unrestricted",
  },
  {
    metric: "hrv",
    mode: "unrestricted",
  },
  {
    metric: "heart_rate_variability",
    mode: "unrestricted",
  },
  {
    metric: "resting_heart_rate",
    mode: "unrestricted",
  },
  {
    metric: "heart_rate",
    mode: "unrestricted",
  },
  {
    metric: "steps",
    mode: "unrestricted",
  },
  {
    metric: "step_count",
    mode: "unrestricted",
  },
  {
    metric: "nutrition",
    mode: "unrestricted",
  },
]

const policyByMetric = new Map<string, MetricSourcePolicy>(
  DEFAULT_POLICIES.map((policy) => [policy.metric, policy])
)

function normalizeMetricId(metric: SourcePreferenceMetricId): string {
  if (metric === "sleep_analysis") return "sleep"
  if (metric === "body_mass") return "weight"
  if (metric === "body_fat_percentage") return "body_fat"
  if (metric === "lean_body_mass") return "lean_mass"
  if (metric === "body_mass_index") return "bmi"
  if (metric === "waist_circumference") return "waist"
  if (metric === "heart_rate_variability") return "hrv"
  if (metric === "step_count") return "steps"
  return metric
}

export function getMetricSourcePolicy(
  metric: SourcePreferenceMetricId
): MetricSourcePolicy {
  const key = normalizeMetricId(metric)
  return (
    policyByMetric.get(key) ??
    policyByMetric.get(metric) ?? {
      metric,
      mode: "unrestricted" as const,
    }
  )
}

export function listMetricSourcePolicies(): MetricSourcePolicy[] {
  const seen = new Set<string>()
  const list: MetricSourcePolicy[] = []
  for (const policy of DEFAULT_POLICIES) {
    const key = normalizeMetricId(policy.metric)
    if (seen.has(key)) continue
    seen.add(key)
    list.push(getMetricSourcePolicy(policy.metric))
  }
  return list
}

export const SourcePreferenceEngine = {
  getPolicy: getMetricSourcePolicy,
  listPolicies: listMetricSourcePolicies,
  matchesSource: matchesSourcePreference,
  sourceIdentity,
  resolveDeviceName,
  parseDeviceName,
  isPreferred(
    record: HealthRecordBase,
    metric: SourcePreferenceMetricId
  ): boolean {
    const policy = getMetricSourcePolicy(metric)
    if (!policy.primary) return false
    return matchesSourcePreference(record, policy.primary)
  },
} as const
