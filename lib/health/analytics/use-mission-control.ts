"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"

import { getBloodStore, getHealthStore } from "@/lib/health"
import { getTreatmentStore } from "@/lib/health/treatment/treatment-store"
import { treatmentTimelineEvents } from "@/lib/health/treatment/timeline"
import { getWorkoutStore } from "@/lib/health/workout"
import { buildMissionControlView } from "./analytics-engine"
import type { McTimeRange, MissionControlView } from "./types"

function subscribeHealth(onStoreChange: () => void) {
  const unsubHealth = getHealthStore().subscribe(onStoreChange)
  const unsubBlood = getBloodStore().subscribe(onStoreChange)
  const unsubTreatment = getTreatmentStore().subscribe(onStoreChange)
  const unsubHevy = getWorkoutStore().subscribe(onStoreChange)
  return () => {
    unsubHealth()
    unsubBlood()
    unsubTreatment()
    unsubHevy()
  }
}

function getVersion(): number {
  return (
    getHealthStore().getRecordCount() * 1000 +
    getBloodStore().getTestCount() * 10 +
    getTreatmentStore().getVersion() +
    getWorkoutStore().getVersion() * 17
  )
}

function getServerVersion(): number {
  return 0
}

/**
 * Mission Control view from Health Store + Blood Store + Treatment Store.
 *
 * Store data is client-only (localStorage / IndexedDB). Until mount completes,
 * return the empty SSR-identical view so hydration HTML matches.
 */
export function useMissionControl(
  bodyRange: McTimeRange = "90d"
): MissionControlView {
  const version = useSyncExternalStore(
    subscribeHealth,
    getVersion,
    getServerVersion
  )
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    getBloodStore().hydrateFromStorage()
    getTreatmentStore().hydrateFromStorage()
    getWorkoutStore().hydrateFromStorage()

    // Health lives in IndexedDB (async). Do not mark ready until it loads —
    // otherwise Mission Control paints the empty view and can miss the update.
    void getHealthStore()
      .hydrateFromStorageAsync()
      .finally(() => {
        if (!cancelled) setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return useMemo(() => {
    if (!ready) {
      return buildMissionControlView([], [], {
        bodyRange,
        treatmentTimeline: [],
        hevyWorkouts: [],
      })
    }

    const treatmentStore = getTreatmentStore()
    return buildMissionControlView(
      getHealthStore().getAll(),
      getBloodStore().getAll(),
      {
        bodyRange,
        hevyWorkouts: getWorkoutStore().getAll(),
        treatmentTimeline: treatmentTimelineEvents(
          treatmentStore.getTreatments(),
          treatmentStore.getEvents()
        ),
      }
    )
  }, [version, bodyRange, ready])
}
