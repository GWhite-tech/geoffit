/**
 * Mission Control page-scoped read DTOs (PR4 Stage 5).
 */

import type { BloodTest } from "@/lib/domain/blood"
import type { HealthRecord, WorkoutHealthRecord } from "@/lib/domain/health"
import type { DoseEvent, Treatment } from "@/lib/domain/treatment"
import { MISSION_CONTROL_HEALTH_METRIC_TYPES as MC_TYPES } from "@/lib/health/analytics/mission-control-metrics"
import type { McTimeRange } from "@/lib/health/analytics/types"
import type { HevyWorkoutEntry } from "@/lib/health/workout/workout-store"

export type MissionControlDomainStatus = "ok" | "empty" | "error"

export type MissionControlReadResponse = {
  bodyRange: McTimeRange
  healthRecords: HealthRecord[]
  bloodTests: BloodTest[]
  hevyWorkouts: HevyWorkoutEntry[]
  appleHealthWorkouts: WorkoutHealthRecord[]
  treatments: Treatment[]
  doseEvents: DoseEvent[]
  domainStatus: {
    health: MissionControlDomainStatus
    blood: MissionControlDomainStatus
    workouts: MissionControlDomainStatus
    treatments: MissionControlDomainStatus
  }
  domainErrors: Partial<
    Record<"health" | "blood" | "workouts" | "treatments", string>
  >
  /** Wall time for parallel repository queries (ms). */
  queryMs: number
  source: "cloud"
}

/** Re-export for cloud read callers. */
export const MISSION_CONTROL_HEALTH_METRIC_TYPES = MC_TYPES
