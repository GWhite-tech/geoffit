/**
 * Cloud fact repository layer (PR2).
 * Repositories + mappers only — no product call sites, no FactWriter wiring.
 */

export { CloudRepositoryError, mapSupabaseError } from "./errors"
export type { CloudRepositoryErrorCode } from "./errors"
export { createCloudRepositories } from "./supabase/create-repos"
export type {
  BloodRepository,
  CloudRepositories,
  FactSyncRepository,
  HealthRepository,
  NutritionRepository,
  TreatmentGraph,
  TreatmentRepository,
  WorkoutRepository,
} from "./repositories/types"
export type {
  FactSyncState,
  FactSyncStatus,
  ListPage,
  SyncCursor,
  UpsertResult,
  WriteContext,
} from "./types"
export { CLOUD_SCHEMA_VERSION } from "./types"

export {
  appleHealthWorkoutCloudFingerprint,
  hevyWorkoutCloudFingerprint,
  nutritionDayCloudFingerprint,
  treatmentCloudFingerprint,
  treatmentDoseCloudFingerprint,
  treatmentLotCloudFingerprint,
} from "./mappers/fingerprints"
