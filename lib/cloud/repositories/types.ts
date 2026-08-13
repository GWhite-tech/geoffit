/**
 * Cloud repository interfaces (PR2). No product call sites.
 */

import type { BloodTest } from "@/lib/domain/blood"
import type { HealthRecord, WorkoutHealthRecord } from "@/lib/domain/health"
import type {
  DoseEvent,
  InventoryLot,
  Treatment,
} from "@/lib/domain/treatment"
import type { NutritionDay } from "@/lib/domain/nutrition"
import type { HevyWorkoutEntry } from "@/lib/health/workout/workout-store"

import type {
  FactSyncState,
  FactSyncStatus,
  ListPage,
  SyncCursor,
  UpsertResult,
  WriteContext,
} from "../types"

export type HealthListByMetricsOptions = {
  metricTypes: string[]
  /** Inclusive lower bound on start_at (ISO). */
  startAt?: string | null
  /** Inclusive upper bound on start_at (ISO). */
  endAt?: string | null
  /** Hard cap on rows returned (repository clamps). */
  limit?: number
}

export interface HealthRepository {
  upsertMany(
    records: HealthRecord[],
    ctx: WriteContext
  ): Promise<UpsertResult>
  listUpdatedSince(
    userId: string,
    cursor: SyncCursor | null,
    limit: number
  ): Promise<ListPage<HealthRecord>>
  /**
   * Page-scoped read: metric types + optional time window (PR4 Stage 5).
   * Never a full-table dump.
   */
  listByMetricTypes(
    userId: string,
    options: HealthListByMetricsOptions
  ): Promise<HealthRecord[]>
  softDeleteByFingerprints(
    userId: string,
    fingerprints: string[]
  ): Promise<number>
}

export type BloodListPanelsOptions = {
  /** Max panels to return (capped by repository). Default 100. */
  limit?: number
  /** Inclusive YYYY-MM-DD lower bound on test_date. */
  fromDate?: string
  /** Inclusive YYYY-MM-DD upper bound on test_date. */
  toDate?: string
}

export interface BloodRepository {
  upsertTests(tests: BloodTest[], ctx: WriteContext): Promise<UpsertResult>
  listUpdatedSince(
    userId: string,
    cursor: SyncCursor | null,
    limit: number
  ): Promise<ListPage<BloodTest>>
  /**
   * Page-scoped read: recent blood panels + markers (PR4).
   * Never a sync dump — ordered by test_date desc with a hard limit.
   */
  listPanels(
    userId: string,
    options?: BloodListPanelsOptions
  ): Promise<BloodTest[]>
  softDeleteByFingerprints(
    userId: string,
    fingerprints: string[]
  ): Promise<number>
}

export type WorkoutListByStartRangeOptions = {
  startAt?: string | null
  endAt?: string | null
  limit?: number
}

export type WorkoutListByStartRangeResult = {
  hevy: HevyWorkoutEntry[]
  appleHealth: WorkoutHealthRecord[]
}

export interface WorkoutRepository {
  upsertHevyMany(
    entries: HevyWorkoutEntry[],
    ctx: WriteContext
  ): Promise<UpsertResult>
  upsertAppleHealthMany(
    records: WorkoutHealthRecord[],
    ctx: WriteContext
  ): Promise<UpsertResult>
  listUpdatedSince(
    userId: string,
    cursor: SyncCursor | null,
    limit: number
  ): Promise<ListPage<HevyWorkoutEntry | WorkoutHealthRecord>>
  /**
   * Page-scoped workouts by start_at (PR4 Stage 5).
   * Splits Hevy vs Apple Health for Mission Control consumers.
   */
  listByStartRange(
    userId: string,
    options?: WorkoutListByStartRangeOptions
  ): Promise<WorkoutListByStartRangeResult>
  softDeleteByFingerprints(
    userId: string,
    fingerprints: string[]
  ): Promise<number>
}

export type TreatmentGraph = {
  treatments: Treatment[]
  lots: InventoryLot[]
  doseEvents: DoseEvent[]
}

export type TreatmentListGraphOptions = {
  treatmentLimit?: number
  doseLimit?: number
  lotLimit?: number
  /** When true, also load inventory lots (Treatment page). MC omits lots. */
  includeLots?: boolean
}

export interface TreatmentRepository {
  upsertGraph(graph: TreatmentGraph, ctx: WriteContext): Promise<UpsertResult>
  listUpdatedSince(
    userId: string,
    cursor: SyncCursor | null,
    limit: number
  ): Promise<ListPage<Treatment>>
  /**
   * Small treatment graph for Mission Control timeline (PR4 Stage 5).
   * Lots omitted unless includeLots — doses + treatments are enough for MC.
   */
  listGraph(
    userId: string,
    options?: TreatmentListGraphOptions
  ): Promise<TreatmentGraph>
}

export interface NutritionRepository {
  upsertMany(days: NutritionDay[], ctx: WriteContext): Promise<UpsertResult>
  listUpdatedSince(
    userId: string,
    cursor: SyncCursor | null,
    limit: number
  ): Promise<ListPage<NutritionDay>>
}

export interface FactSyncRepository {
  ensureState(userId: string): Promise<FactSyncState>
  getState(userId: string): Promise<FactSyncState | null>
  setStatus(
    userId: string,
    status: FactSyncStatus,
    error?: string | null
  ): Promise<void>
  updatePullCursor(
    userId: string,
    table: string,
    cursor: SyncCursor | null
  ): Promise<void>
  markMigrationComplete(
    userId: string,
    migrationVersion: string
  ): Promise<void>
  markSyncSuccess(userId: string): Promise<void>
  markSyncFailure(userId: string, error: string): Promise<void>
}

export type CloudRepositories = {
  health: HealthRepository
  blood: BloodRepository
  workouts: WorkoutRepository
  treatments: TreatmentRepository
  nutrition: NutritionRepository
  factSync: FactSyncRepository
}
