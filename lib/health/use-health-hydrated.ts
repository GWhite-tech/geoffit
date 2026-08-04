"use client"

import { useEffect, useSyncExternalStore } from "react"

import { getHealthStore } from "./health-store"

function subscribe(onStoreChange: () => void) {
  return getHealthStore().subscribe(onStoreChange)
}

function getHydrated(): boolean {
  return getHealthStore().isHydrated()
}

function getServerHydrated(): boolean {
  return false
}

/**
 * True once HealthStore has finished its IndexedDB hydrate.
 *
 * SSR + first client paint stay false (matches empty HTML). After Mission
 * Control (or any prior page) has hydrated, client navigations see true
 * immediately — no second IDB wait, no empty analytics rebuild.
 */
export function useHealthHydrated(): boolean {
  const hydrated = useSyncExternalStore(
    subscribe,
    getHydrated,
    getServerHydrated
  )

  useEffect(() => {
    void getHealthStore().hydrateFromStorageAsync()
  }, [])

  return hydrated
}
