"use client"

import { useEffect, useMemo, useSyncExternalStore } from "react"

import { getHealthStore, useHealthHydrated } from "@/lib/health"
import { buildWorkouts, getWorkoutStore } from "@/lib/health/workout"

import {
  buildProgrammeDashboard,
} from "./programme-dashboard"
import type { ProgrammeDashboardView } from "./coaching-types"
import { getProgrammeStore } from "./programme-store"

function subscribe(onStoreChange: () => void) {
  const unsubs = [
    getHealthStore().subscribe(onStoreChange),
    getWorkoutStore().subscribe(onStoreChange),
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
    getProgrammeStore().getVersion()
  )
}

export function useProgrammeDashboard(
  selectedSessionId: string | null = null
): ProgrammeDashboardView {
  const version = useSyncExternalStore(subscribe, getVersion, () => 0)
  const hydrated = useHealthHydrated()

  useEffect(() => {
    getProgrammeStore().hydrateFromStorage()
    getWorkoutStore().hydrateFromStorage()
  }, [])

  return useMemo(() => {
    if (!hydrated) {
      return buildProgrammeDashboard({
        records: [],
        hevyWorkouts: [],
        workouts: [],
        selectedSessionId,
      })
    }
    const records = getHealthStore().getAll()
    const hevyWorkouts = getWorkoutStore().getAll()
    return buildProgrammeDashboard({
      records,
      hevyWorkouts,
      workouts: buildWorkouts({
        healthRecords: records,
        hevyWorkouts,
      }),
      selectedSessionId,
    })
  }, [version, hydrated, selectedSessionId])
}

export function useProgrammeActions() {
  const store = getProgrammeStore()
  return {
    activate: (id: string) => store.activate(id),
    deactivate: () => store.deactivate(),
    setCursor: (week: number, order: number) => store.setCursor(week, order),
    advanceAfterSession: () => store.advanceAfterSession(),
  }
}
