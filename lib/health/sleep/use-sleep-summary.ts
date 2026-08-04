"use client"

import { useMemo, useSyncExternalStore } from "react"

import { getHealthStore, useHealthHydrated } from "@/lib/health"
import { buildSleepSummary } from "./sleep-engine"
import type { SleepSummary, SleepTrendRange } from "./types"

function subscribe(onStoreChange: () => void) {
  return getHealthStore().subscribe(onStoreChange)
}

function getRecordCount(): number {
  return getHealthStore().getRecordCount()
}

function getServerRecordCount(): number {
  return 0
}

/**
 * Subscribe to Health Store and project a SleepSummary for the Sleep page.
 */
export function useSleepSummary(
  trendRange: SleepTrendRange = "30d"
): SleepSummary {
  const recordCount = useSyncExternalStore(
    subscribe,
    getRecordCount,
    getServerRecordCount
  )
  const hydrated = useHealthHydrated()

  return useMemo(() => {
    if (!hydrated) {
      return buildSleepSummary([], { trendRange })
    }
    return buildSleepSummary(getHealthStore().getAll(), { trendRange })
  }, [recordCount, trendRange, hydrated])
}
