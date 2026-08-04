"use client"

import { useEffect, useSyncExternalStore } from "react"

import { getBloodStore, getHealthStore, type HealthSummary } from "@/lib/health"

function subscribe(onStoreChange: () => void) {
  return getHealthStore().subscribe(onStoreChange)
}

function getSnapshot(): HealthSummary {
  return getHealthStore().getSnapshot()
}

function getServerSnapshot(): HealthSummary {
  return getHealthStore().getSnapshot()
}

/**
 * Subscribe to the Health Store.
 * Hydrates from IndexedDB on mount so Mission Control sees imported data.
 */
export function useHealthSummary(): HealthSummary {
  useEffect(() => {
    console.info(
      "[useHealthSummary] mount — store records=",
      getHealthStore().getRecordCount(),
      "hasData=",
      getHealthStore().getSnapshot().hasData
    )
    void getHealthStore()
      .hydrateFromStorageAsync()
      .then(() => {
        console.info(
          "[useHealthSummary] after hydrate — records=",
          getHealthStore().getRecordCount(),
          "hasData=",
          getHealthStore().getSnapshot().hasData,
          "summary=",
          {
            weight: getHealthStore().getSnapshot().snapshot.weight.value,
            sleep: getHealthStore().getSnapshot().snapshot.sleep.value,
            hrv: getHealthStore().getSnapshot().snapshot.hrv.value,
          }
        )
      })
    getBloodStore().hydrateFromStorage()
  }, [])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
