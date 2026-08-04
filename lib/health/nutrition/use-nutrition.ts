"use client"

import { useEffect, useMemo, useSyncExternalStore } from "react"

import { getHealthStore, useHealthHydrated } from "@/lib/health"
import { getNutritionStore } from "@/lib/health/nutrition/nutrition-store"
import {
  buildNutritionInsights,
  buildNutritionSummary,
} from "@/lib/health/nutrition/analytics"
import type { NutritionTargets } from "@/lib/domain/nutrition"
import type { NutritionRange } from "@/lib/health/nutrition/selectors"
import { todayKey } from "@/lib/health/nutrition/selectors"

function subscribe(onStoreChange: () => void) {
  const unsubNutrition = getNutritionStore().subscribe(onStoreChange)
  const unsubHealth = getHealthStore().subscribe(onStoreChange)
  return () => {
    unsubNutrition()
    unsubHealth()
  }
}

function getVersion(): number {
  return (
    getNutritionStore().getVersion() * 1000 + getHealthStore().getRecordCount()
  )
}

function getServerVersion(): number {
  return 0
}

function syncNutritionFromHealth(): void {
  const health = getHealthStore()
  const nutrition = getNutritionStore()
  nutrition.syncFromHealthRecords(health.getAll())
}

export function useNutritionStoreVersion(): number {
  const version = useSyncExternalStore(subscribe, getVersion, getServerVersion)
  const hydrated = useHealthHydrated()

  useEffect(() => {
    getNutritionStore().hydrateFromStorage()
  }, [])

  useEffect(() => {
    if (!hydrated) return
    syncNutritionFromHealth()
  }, [hydrated, version])

  return version
}

export function useNutritionSummary(
  range: NutritionRange,
  anchorDate?: string
) {
  const version = useNutritionStoreVersion()
  const hydrated = useHealthHydrated()

  return useMemo(() => {
    if (!hydrated) {
      return buildNutritionSummary(
        [],
        getNutritionStore().getTargets(),
        range,
        anchorDate
      )
    }
    const store = getNutritionStore()
    return buildNutritionSummary(
      store.getDays(),
      store.getTargets(),
      range,
      anchorDate
    )
  }, [version, range, anchorDate, hydrated])
}

export function useNutritionDay(date: string) {
  const version = useNutritionStoreVersion()
  return useMemo(() => {
    const store = getNutritionStore()
    return {
      day: store.getDay(date),
      targets: store.getTargets(),
    }
  }, [version, date])
}

export function useNutritionInsights(range: NutritionRange) {
  const version = useNutritionStoreVersion()
  const hydrated = useHealthHydrated()
  return useMemo(() => {
    if (!hydrated) {
      return buildNutritionInsights(
        [],
        getNutritionStore().getTargets(),
        []
      )
    }
    const store = getNutritionStore()
    const summary = buildNutritionSummary(
      store.getDays(),
      store.getTargets(),
      range
    )
    const rangedDates = new Set(summary.history.map((day) => day.date))
    const days = store.getDays().filter((day) => rangedDates.has(day.date))
    return buildNutritionInsights(
      days.length > 0 ? days : store.getDays(),
      store.getTargets(),
      getHealthStore().getAll()
    )
  }, [version, range, hydrated])
}

export function useNutritionAnchor(): string {
  const version = useNutritionStoreVersion()
  return useMemo(() => {
    return getNutritionStore().getLatestDay()?.date ?? todayKey()
  }, [version])
}

export function setNutritionTargets(targets: NutritionTargets): void {
  getNutritionStore().setTargets(targets)
}
