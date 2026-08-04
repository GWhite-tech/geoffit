/**
 * WorkoutStore — connector-agnostic persistence for Hevy structure data.
 *
 * CSV importer and future Hevy API both ingest here.
 * Downstream merge/UI only sees source "Hevy" — never CSV vs API.
 */

import type { WorkoutExercise } from "@/lib/domain/workout"
import { WORKOUT_SOURCE_LABELS } from "@/lib/domain/workout"
import type { ExerciseHistory } from "@/lib/domain/exercise-history"

import { classifyWorkoutActivity } from "./classify"
import type { WorkoutContribution } from "./contribution"
import { buildExerciseHistories } from "./exercise-history"
import { fingerprintContribution } from "./fingerprint"

export type HevyWorkoutEntry = {
  id: string
  /** Hevy workout title */
  name: string
  startDate: string
  endDate: string
  durationSeconds: number
  /** Optional HK-style or free-text activity hint */
  activityType?: string
  exercises: WorkoutExercise[]
  volumeKg?: number
  /** Best estimated 1RM across the session. */
  estimated1RmKg?: number
  rpe?: number
  notes?: string
  externalId?: string
}

const STORAGE_KEY = "geoffit.workout-store.v1"
const LEGACY_STORAGE_KEY = "geoffit.hevy-workouts.v1"

type Listener = () => void

type PersistPayload = {
  version: 1
  /** Always "hevy" — never distinguish csv vs api in persisted shape. */
  connector: "hevy"
  updatedAt: string
  workouts: HevyWorkoutEntry[]
}

/**
 * Map a Hevy entry to a structure-owned contribution.
 */
export function contributionFromHevy(
  entry: HevyWorkoutEntry
): WorkoutContribution {
  const activityType =
    entry.activityType ?? "HKWorkoutActivityTypeTraditionalStrengthTraining"
  const category = classifyWorkoutActivity(activityType, entry.name)
  return {
    id: entry.id,
    fingerprint: fingerprintContribution({
      source: "hevy",
      category,
      activityType,
      startDate: entry.startDate,
      endDate: entry.endDate,
      durationSeconds: entry.durationSeconds,
      externalId: entry.externalId ?? entry.id,
    }),
    source: "hevy",
    sourceLabel: WORKOUT_SOURCE_LABELS.hevy,
    category,
    activityType,
    startDate: entry.startDate,
    endDate: entry.endDate,
    durationSeconds: entry.durationSeconds,
    name: entry.name,
    exercises: entry.exercises,
    volumeKg: entry.volumeKg,
    rpe: entry.rpe,
    notes: entry.notes,
  }
}

export function contributionsFromHevy(
  entries: HevyWorkoutEntry[]
): WorkoutContribution[] {
  return entries.map(contributionFromHevy)
}

/**
 * Single store for Hevy workouts — CSV today, API tomorrow.
 */
export class WorkoutStore {
  private workouts: HevyWorkoutEntry[] = []
  private listeners = new Set<Listener>()
  private hydrated = false

  hydrateFromStorage(): void {
    if (typeof window === "undefined") return
    if (this.hydrated) return
    this.hydrated = true
    try {
      const raw =
        window.localStorage.getItem(STORAGE_KEY) ??
        window.localStorage.getItem(LEGACY_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as PersistPayload
      if (Array.isArray(parsed.workouts)) {
        this.workouts = parsed.workouts
      }
      // Migrate legacy key once.
      if (
        !window.localStorage.getItem(STORAGE_KEY) &&
        window.localStorage.getItem(LEGACY_STORAGE_KEY)
      ) {
        this.persist()
        window.localStorage.removeItem(LEGACY_STORAGE_KEY)
      }
    } catch {
      // ignore corrupt storage
    }
  }

  getAll(): HevyWorkoutEntry[] {
    this.hydrateFromStorage()
    return this.workouts
  }

  getVersion(): number {
    return this.workouts.length
  }

  getExerciseHistories(): ExerciseHistory[] {
    return buildExerciseHistories(this.getAll())
  }

  /**
   * Upsert workouts by id / externalId.
   * Used by CSV importer and future Hevy API connector alike.
   */
  ingest(entries: HevyWorkoutEntry[]): void {
    if (entries.length === 0) return
    const byId = new Map(this.workouts.map((w) => [w.id, w]))
    for (const entry of entries) {
      byId.set(entry.id, entry)
      if (entry.externalId && entry.externalId !== entry.id) {
        // Drop any prior row keyed only by the same external identity.
        for (const [id, existing] of byId) {
          if (
            id !== entry.id &&
            existing.externalId &&
            existing.externalId === entry.externalId
          ) {
            byId.delete(id)
          }
        }
      }
    }
    this.workouts = [...byId.values()].sort((a, b) =>
      a.startDate.localeCompare(b.startDate)
    )
    this.hydrated = true
    this.persist()
    this.emit()
  }

  replaceAll(entries: HevyWorkoutEntry[]): void {
    this.workouts = [...entries].sort((a, b) =>
      a.startDate.localeCompare(b.startDate)
    )
    this.hydrated = true
    this.persist()
    this.emit()
  }

  clear(): void {
    this.workouts = []
    this.persist()
    this.emit()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private persist(): void {
    if (typeof window === "undefined") return
    try {
      const payload: PersistPayload = {
        version: 1,
        connector: "hevy",
        updatedAt: new Date().toISOString(),
        workouts: this.workouts,
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // quota / private mode
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

let singleton: WorkoutStore | null = null

export function getWorkoutStore(): WorkoutStore {
  if (!singleton) singleton = new WorkoutStore()
  return singleton
}

export function resetWorkoutStore(): void {
  singleton = null
}

/** @deprecated Prefer getWorkoutStore — same singleton. */
export function getHevyWorkoutStore(): WorkoutStore {
  return getWorkoutStore()
}

/** @deprecated Prefer resetWorkoutStore. */
export function resetHevyWorkoutStore(): void {
  resetWorkoutStore()
}

/** @deprecated Prefer WorkoutStore. */
export class HevyWorkoutStore extends WorkoutStore {}
