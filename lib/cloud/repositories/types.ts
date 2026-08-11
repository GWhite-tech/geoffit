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
  softDeleteByFingerprints(
    userId: string,
    fingerprints: string[]
  ): Promise<number>
}

export interface BloodRepository {
  upsertTests(tests: BloodTest[], ctx: WriteContext): Promise<UpsertResult>
  listUpdatedSince(
    userId: string,
    cursor: SyncCursor | null,
    limit: number
  ): Promise<ListPage<BloodTest>>
  softDeleteByFingerprints(
    userId: string,
    fingerprints: string[]
  ): Promise<number>
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

export interface TreatmentRepository {
  upsertGraph(graph: TreatmentGraph, ctx: WriteContext): Promise<UpsertResult>
  listUpdatedSince(
    userId: string,
    cursor: SyncCursor | null,
    limit: number
  ): Promise<ListPage<Treatment>>
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
