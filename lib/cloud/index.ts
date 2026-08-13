/**
 * Cloud fact repository layer (PR2) + page-scoped Mission Control reads.
 * Repositories + mappers only — no product call sites, no FactWriter wiring.
 */

export { CloudRepositoryError, mapSupabaseError } from "./errors"
export type { CloudRepositoryErrorCode } from "./errors"
export { createCloudRepositories } from "./supabase/create-repos"
export type {
  BloodListPanelsOptions,
  BloodRepository,
  CloudRepositories,
  FactSyncRepository,
  HealthListByMetricsOptions,
  HealthRepository,
  NutritionRepository,
  TreatmentGraph,
  TreatmentListGraphOptions,
  TreatmentRepository,
  WorkoutListByStartRangeOptions,
  WorkoutListByStartRangeResult,
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
