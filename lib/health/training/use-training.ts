"use client"

import { useEffect, useMemo, useSyncExternalStore } from "react"

import { getHealthStore, useHealthHydrated } from "@/lib/health"
import { getProgrammeStore } from "@/lib/health/programme"
import { getWorkoutStore } from "@/lib/health/workout"

import { buildTrainingView } from "./training-analytics"
import { getTrainingStore } from "./training-store"
import type {
  StrengthMetricId,
  TrainingRange,
  TrainingView,
} from "./types"

function subscribe(onStoreChange: () => void) {
  const unsubs = [
    getHealthStore().subscribe(onStoreChange),
    getWorkoutStore().subscribe(onStoreChange),
    getTrainingStore().subscribe(onStoreChange),
    getProgrammeStore().subscribe(onStoreChange),
  ]
  return () => {
    for (const unsub of unsubs) unsub()
  }
}

function getVersion(): number {
  return (
    getHealthStore().getRecordCount() * 10_000 +
    getWorkoutStore().getVersion() * 17 +
    getTrainingStore().getVersion() * 13 +
    getProgrammeStore().getVersion()
  )
}

function getServerVersion(): number {
  return 0
}

export function useTraining(): TrainingView {
  const version = useSyncExternalStore(subscribe, getVersion, getServerVersion)
  const hydrated = useHealthHydrated()

  const range = useSyncExternalStore(
    (onChange) => getTrainingStore().subscribe(onChange),
    () => getTrainingStore().getRange(),
    () => "90d" as TrainingRange
  )
  const stepRange = useSyncExternalStore(
    (onChange) => getTrainingStore().subscribe(onChange),
    () => getTrainingStore().getStepRange(),
    () => "30d" as TrainingRange
  )
  const strengthMetric = useSyncExternalStore(
    (onChange) => getTrainingStore().subscribe(onChange),
    () => getTrainingStore().getStrengthMetric(),
    () => "weekly_volume" as StrengthMetricId
  )
  const selectedExercise = useSyncExternalStore(
    (onChange) => getTrainingStore().subscribe(onChange),
    () => getTrainingStore().getSelectedExercise(),
    () => null as string | null
  )
  const goals = useSyncExternalStore(
    (onChange) => getTrainingStore().subscribe(onChange),
    () => getTrainingStore().getGoals(),
    () => getTrainingStore().getGoals()
  )

  useEffect(() => {
    getTrainingStore().hydrateFromStorage()
    getWorkoutStore().hydrateFromStorage()
    getProgrammeStore().hydrateFromStorage()
  }, [])

  return useMemo(() => {
    if (!hydrated) {
      return buildTrainingView({
        records: [],
        hevyWorkouts: [],
        range,
        stepRange,
        strengthMetric,
        selectedExercise,
        goals,
      })
    }
    return buildTrainingView({
      records: getHealthStore().getAll(),
      hevyWorkouts: getWorkoutStore().getAll(),
      range,
      stepRange,
      strengthMetric,
      selectedExercise,
      goals,
    })
  }, [version, hydrated, range, stepRange, strengthMetric, selectedExercise, goals])
}

export function useTrainingRange(): {
  range: TrainingRange
  setRange: (range: TrainingRange) => void
} {
  const range = useSyncExternalStore(
    (onChange) => getTrainingStore().subscribe(onChange),
    () => getTrainingStore().getRange(),
    () => "90d" as TrainingRange
  )
  return {
    range,
    setRange: (next) => getTrainingStore().setRange(next),
  }
}

export function useTrainingControls() {
  const store = getTrainingStore()
  const range = useSyncExternalStore(
    (onChange) => store.subscribe(onChange),
    () => store.getRange(),
    () => "90d" as TrainingRange
  )
  const stepRange = useSyncExternalStore(
    (onChange) => store.subscribe(onChange),
    () => store.getStepRange(),
    () => "30d" as TrainingRange
  )
  const strengthMetric = useSyncExternalStore(
    (onChange) => store.subscribe(onChange),
    () => store.getStrengthMetric(),
    () => "weekly_volume" as StrengthMetricId
  )
  const selectedExercise = useSyncExternalStore(
    (onChange) => store.subscribe(onChange),
    () => store.getSelectedExercise(),
    () => null as string | null
  )
  const goals = useSyncExternalStore(
    (onChange) => store.subscribe(onChange),
    () => store.getGoals(),
    () => store.getGoals()
  )

  useEffect(() => {
    store.hydrateFromStorage()
  }, [store])

  return {
    range,
    setRange: (next: TrainingRange) => store.setRange(next),
    stepRange,
    setStepRange: (next: TrainingRange) => store.setStepRange(next),
    strengthMetric,
    setStrengthMetric: (next: StrengthMetricId) => store.setStrengthMetric(next),
    selectedExercise,
    setSelectedExercise: (name: string | null) =>
      store.setSelectedExercise(name),
    goals,
    setGoals: (patch: Parameters<typeof store.setGoals>[0]) =>
      store.setGoals(patch),
    activateProgramme: (programmeId: string) =>
      getProgrammeStore().activate(programmeId),
    deactivateProgramme: () => getProgrammeStore().deactivate(),
  }
}
