/**
 * TrainingStore — range, exercise, and training goal preferences.
 */

import {
  DEFAULT_TRAINING_GOALS,
} from "./training-goal-engine"
import type {
  StrengthMetricId,
  TrainingGoals,
  TrainingRange,
} from "./types"

const STORAGE_KEY = "geoffit.training-store.v1"

type Listener = () => void

type PersistPayload = {
  version: 1
  range: TrainingRange
  strengthMetric: StrengthMetricId
  selectedExercise: string | null
  stepRange: TrainingRange
  goals?: TrainingGoals
}

function mergeGoals(partial?: Partial<TrainingGoals> | null): TrainingGoals {
  return {
    ...DEFAULT_TRAINING_GOALS,
    ...partial,
    muscleSetTargets: {
      ...DEFAULT_TRAINING_GOALS.muscleSetTargets,
      ...(partial?.muscleSetTargets ?? {}),
    },
  }
}

export class TrainingStore {
  private range: TrainingRange = "90d"
  private strengthMetric: StrengthMetricId = "weekly_volume"
  private selectedExercise: string | null = null
  private stepRange: TrainingRange = "30d"
  private goals: TrainingGoals = DEFAULT_TRAINING_GOALS
  private listeners = new Set<Listener>()
  private hydrated = false
  private version = 0

  hydrateFromStorage(): void {
    if (typeof window === "undefined") return
    if (this.hydrated) return
    this.hydrated = true
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<PersistPayload>
      if (parsed.range) this.range = parsed.range
      if (parsed.strengthMetric) this.strengthMetric = parsed.strengthMetric
      if (parsed.selectedExercise !== undefined) {
        this.selectedExercise = parsed.selectedExercise
      }
      if (parsed.stepRange) this.stepRange = parsed.stepRange
      if (parsed.goals) this.goals = mergeGoals(parsed.goals)
    } catch {
      // ignore
    }
  }

  getVersion(): number {
    return this.version
  }

  getRange(): TrainingRange {
    this.hydrateFromStorage()
    return this.range
  }

  setRange(range: TrainingRange): void {
    this.range = range
    this.persist()
    this.emit()
  }

  getStrengthMetric(): StrengthMetricId {
    this.hydrateFromStorage()
    return this.strengthMetric
  }

  setStrengthMetric(metric: StrengthMetricId): void {
    this.strengthMetric = metric
    this.persist()
    this.emit()
  }

  getSelectedExercise(): string | null {
    this.hydrateFromStorage()
    return this.selectedExercise
  }

  setSelectedExercise(name: string | null): void {
    this.selectedExercise = name
    this.persist()
    this.emit()
  }

  getStepRange(): TrainingRange {
    this.hydrateFromStorage()
    return this.stepRange
  }

  setStepRange(range: TrainingRange): void {
    this.stepRange = range
    this.persist()
    this.emit()
  }

  getGoals(): TrainingGoals {
    this.hydrateFromStorage()
    return this.goals
  }

  setGoals(patch: Partial<TrainingGoals>): void {
    this.goals = mergeGoals({ ...this.goals, ...patch })
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
        range: this.range,
        strengthMetric: this.strengthMetric,
        selectedExercise: this.selectedExercise,
        stepRange: this.stepRange,
        goals: this.goals,
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // ignore
    }
  }

  private emit(): void {
    this.version += 1
    for (const listener of this.listeners) listener()
  }
}

let singleton: TrainingStore | null = null

export function getTrainingStore(): TrainingStore {
  if (!singleton) singleton = new TrainingStore()
  return singleton
}

export function resetTrainingStore(): void {
  singleton = null
}
