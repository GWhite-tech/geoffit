/**
 * DataRepository — storage-agnostic contracts for health domains.
 *
 * Health pages should depend on these interfaces, not IndexedDB or Supabase
 * directly. Implementations will arrive when migration begins.
 */

export type RepositorySource = "local" | "cloud" | "sync"

export type RepositoryResult<T> = {
  data: T
  source: RepositorySource
  asOf: string
}

export interface WeightRepository {
  list(range?: { from?: string; to?: string }): Promise<RepositoryResult<unknown[]>>
  latest(): Promise<RepositoryResult<unknown | null>>
}

export interface SleepRepository {
  listSessions(range?: {
    from?: string
    to?: string
  }): Promise<RepositoryResult<unknown[]>>
}

export interface NutritionRepository {
  getDay(day: string): Promise<RepositoryResult<unknown | null>>
  listDays(range?: { from?: string; to?: string }): Promise<RepositoryResult<unknown[]>>
}

export interface TrainingRepository {
  listWorkouts(range?: {
    from?: string
    to?: string
  }): Promise<RepositoryResult<unknown[]>>
}

export interface BloodRepository {
  listPanels(): Promise<RepositoryResult<unknown[]>>
  getPanel(id: string): Promise<RepositoryResult<unknown | null>>
}

export interface TreatmentRepository {
  listTreatments(): Promise<RepositoryResult<unknown[]>>
  listDoseEvents(range?: {
    from?: string
    to?: string
  }): Promise<RepositoryResult<unknown[]>>
}

export interface HealthDataRepositories {
  weight: WeightRepository
  sleep: SleepRepository
  nutrition: NutritionRepository
  training: TrainingRepository
  blood: BloodRepository
  treatments: TreatmentRepository
}

/**
 * Placeholder accessor — throws until local/cloud adapters are wired.
 * Do not call from production UI yet.
 */
export function getHealthRepositories(): HealthDataRepositories {
  throw new Error(
    "Health DataRepository adapters are not wired yet. Continue using local stores until migration."
  )
}
