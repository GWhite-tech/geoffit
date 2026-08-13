/**
 * Shared Mission Control cloud query window helpers (PR4 Stage 5).
 */

import {
  MISSION_CONTROL_BODY_METRIC_TYPES,
  MISSION_CONTROL_HEALTH_METRIC_TYPES,
  MISSION_CONTROL_RECOVERY_METRIC_TYPES,
} from "@/lib/health/analytics/mission-control-metrics"
import { daysForMcRange } from "@/lib/health/analytics/series"
import type { McTimeRange } from "@/lib/health/analytics/types"

/**
 * PostgREST commonly caps rows at 1000 regardless of requested limit.
 * Keep each MC health sub-query at or below this.
 */
export const MISSION_CONTROL_HEALTH_QUERY_MAX = 1000

/** Sparse body metrics — enough for 2y of daily weigh-ins. */
export const MISSION_CONTROL_BODY_LIMIT_DEFAULT = 800

/** Dense recovery metrics — recent window only; separate from body. */
export const MISSION_CONTROL_RECOVERY_LIMIT_DEFAULT = 1000

/** Recovery/performance need ~90d even when body chart is 7d. */
export function missionControlHealthWindowDays(bodyRange: McTimeRange): number {
  const days = daysForMcRange(bodyRange)
  if (days == null) return 730 // 2y hard cap for "all"
  return Math.max(days, 90)
}

export function missionControlStartAt(bodyRange: McTimeRange): string {
  const days = missionControlHealthWindowDays(bodyRange)
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

export function missionControlHealthMetricTypes(): string[] {
  return [...MISSION_CONTROL_HEALTH_METRIC_TYPES]
}

export function missionControlBodyMetricTypes(): string[] {
  return [...MISSION_CONTROL_BODY_METRIC_TYPES]
}

export function missionControlRecoveryMetricTypes(): string[] {
  return [...MISSION_CONTROL_RECOVERY_METRIC_TYPES]
}

function clampMcHealthLimit(limit: number | undefined, fallback: number): number {
  const v =
    typeof limit === "number" && Number.isFinite(limit)
      ? Math.floor(limit)
      : fallback
  return Math.max(1, Math.min(v, MISSION_CONTROL_HEALTH_QUERY_MAX))
}

export function clampMissionControlBodyLimit(limit?: number): number {
  return clampMcHealthLimit(limit, MISSION_CONTROL_BODY_LIMIT_DEFAULT)
}

export function clampMissionControlRecoveryLimit(limit?: number): number {
  return clampMcHealthLimit(limit, MISSION_CONTROL_RECOVERY_LIMIT_DEFAULT)
}

export function isMcTimeRange(value: string | null): value is McTimeRange {
  return (
    value === "7d" ||
    value === "30d" ||
    value === "90d" ||
    value === "6m" ||
    value === "1y" ||
    value === "all"
  )
}
