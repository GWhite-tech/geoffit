/**
 * Sleep engine — orchestration entry for the Sleep module.
 * Pages consume SleepSummary only; never calculate inline.
 */

import type { HealthRecord } from "@/lib/domain/health"

import { generateSleepSummary } from "./sleep-summary"
import type { SleepSummary, SleepTrendRange } from "./types"

export type SleepEngineOptions = {
  trendRange?: SleepTrendRange
  /** Nightly sleep target in minutes. Default 8h. */
  targetMinutes?: number
}

/**
 * Build the Sleep module read model from Health Store records.
 */
export function buildSleepSummary(
  records: HealthRecord[],
  options: SleepEngineOptions = {}
): SleepSummary {
  return generateSleepSummary(records, options)
}

export { generateSleepSummary } from "./sleep-summary"
export * from "./sleep-selectors"
export * from "./sleep-statistics"
export type * from "./types"
