"use client"

import { useEffect, useMemo, useSyncExternalStore } from "react"

import { getBloodStore, getHealthStore, useHealthHydrated } from "@/lib/health"
import { getNutritionStore } from "@/lib/health/nutrition/nutrition-store"
import { getTreatmentStore } from "@/lib/health/treatment/treatment-store"

import {
  buildProgressView,
  exportProgressSummary,
} from "./progress-analytics"
import { getProgressStore } from "./progress-store"
import type { ProgressRange, ProgressView } from "./types"

function subscribe(onStoreChange: () => void) {
  const unsubs = [
    getHealthStore().subscribe(onStoreChange),
    getBloodStore().subscribe(onStoreChange),
    getNutritionStore().subscribe(onStoreChange),
    getTreatmentStore().subscribe(onStoreChange),
    getProgressStore().subscribe(onStoreChange),
  ]
  return () => {
    for (const unsub of unsubs) unsub()
  }
}

function getVersion(): number {
  return (
    getHealthStore().getRecordCount() * 100_000 +
    getBloodStore().getTestCount() * 1_000 +
    getNutritionStore().getVersion() * 10 +
    getTreatmentStore().getVersion() +
    getProgressStore().getVersion()
  )
}

function getServerVersion(): number {
  return 0
}

function syncNutrition(): void {
  getNutritionStore().syncFromHealthRecords(getHealthStore().getAll())
}

export function useProgress(rangeOverride?: ProgressRange): ProgressView {
  const version = useSyncExternalStore(subscribe, getVersion, getServerVersion)
  const hydrated = useHealthHydrated()
  const storeRange = useSyncExternalStore(
    (onChange) => getProgressStore().subscribe(onChange),
    () => getProgressStore().getRange(),
    () => "90d" as ProgressRange
  )
  const range = rangeOverride ?? storeRange

  useEffect(() => {
    getProgressStore().hydrateFromStorage()
    getBloodStore().hydrateFromStorage()
    getTreatmentStore().hydrateFromStorage()
    getNutritionStore().hydrateFromStorage()
  }, [])

  useEffect(() => {
    if (!hydrated) return
    syncNutrition()
  }, [hydrated, version])

  return useMemo(() => {
    if (!hydrated) {
      return buildProgressView({
        records: [],
        bloodTests: [],
        nutritionDays: [],
        nutritionTargets: getNutritionStore().getTargets(),
        treatments: [],
        events: [],
        range,
      })
    }
    return buildProgressView({
      records: getHealthStore().getAll(),
      bloodTests: getBloodStore().getAll(),
      nutritionDays: getNutritionStore().getDays(),
      nutritionTargets: getNutritionStore().getTargets(),
      treatments: getTreatmentStore().getTreatments(),
      events: getTreatmentStore().getEvents(),
      range,
    })
  }, [version, range, hydrated])
}

export function useProgressRange(): {
  range: ProgressRange
  setRange: (range: ProgressRange) => void
} {
  const range = useSyncExternalStore(
    (onChange) => getProgressStore().subscribe(onChange),
    () => getProgressStore().getRange(),
    () => "90d" as ProgressRange
  )

  useEffect(() => {
    getProgressStore().hydrateFromStorage()
  }, [])

  return {
    range,
    setRange: (next) => getProgressStore().setRange(next),
  }
}

export function downloadProgressExport(view: ProgressView): void {
  if (typeof window === "undefined") return
  const json = exportProgressSummary(view)
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `geoffit-progress-${view.range}-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
