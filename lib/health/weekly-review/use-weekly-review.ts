"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"

import { getBloodStore } from "@/lib/health/blood-store"
import { getHealthStore, useHealthHydrated } from "@/lib/health"
import { getNutritionStore } from "@/lib/health/nutrition"
import { getTreatmentStore } from "@/lib/health/treatment"
import { getWorkoutStore } from "@/lib/health/workout"
import { getSettingsStore } from "@/lib/settings"

import { buildWeeklyReview } from "./weekly-review-engine"
import { getWeeklyReviewStore } from "./weekly-review-store"
import type { WeeklyReviewView } from "./types"
import {
  defaultWeeklyReviewWeekId,
  listRecentWeekBounds,
  previousWeekBounds,
  weekBoundsForAnchor,
} from "./week"

function isAutoWeeklyReviewEnabled(): boolean {
  getSettingsStore().hydrateFromStorage()
  return getSettingsStore().getValue("coach.weekly_review") !== false
}

function subscribe(onChange: () => void) {
  const unsubs = [
    getHealthStore().subscribe(onChange),
    getBloodStore().subscribe(onChange),
    getNutritionStore().subscribe(onChange),
    getTreatmentStore().subscribe(onChange),
    getWorkoutStore().subscribe(onChange),
    getWeeklyReviewStore().subscribe(onChange),
  ]
  return () => {
    for (const unsub of unsubs) unsub()
  }
}

function getVersion(): number {
  return (
    getHealthStore().getRecordCount() * 1000 +
    getBloodStore().getAll().length * 17 +
    getNutritionStore().getVersion() * 19 +
    getTreatmentStore().getVersion() * 23 +
    getWorkoutStore().getVersion() * 13 +
    getWeeklyReviewStore().getVersion()
  )
}

function collectInput() {
  return {
    records: getHealthStore().getAll(),
    bloodTests: getBloodStore().getAll(),
    nutritionDays: getNutritionStore().getDays(),
    nutritionTargets: getNutritionStore().getTargets(),
    treatments: getTreatmentStore().getTreatments(),
    events: getTreatmentStore().getEvents(),
    hevyWorkouts: getWorkoutStore().getAll(),
  }
}

function buildAndSave(weekId: string): WeeklyReviewView {
  const weeks = listRecentWeekBounds(16)
  const bounds =
    weeks.find((week) => week.id === weekId) ?? weekBoundsForAnchor()
  const built = buildWeeklyReview({
    ...collectInput(),
    bounds,
  })
  getWeeklyReviewStore().save(built)
  return built
}

/** Ensure completed + current weeks exist (Sunday schedule + Monday open). */
export function ensureWeeklyReviews(options?: {
  force?: boolean
}): WeeklyReviewView | null {
  if (typeof window === "undefined") return null
  const store = getWeeklyReviewStore()
  store.hydrateFromStorage()
  getWorkoutStore().hydrateFromStorage()
  getNutritionStore().hydrateFromStorage()
  getBloodStore().hydrateFromStorage()
  getTreatmentStore().hydrateFromStorage()

  if (!options?.force && !isAutoWeeklyReviewEnabled()) {
    return (
      store.getByWeekId(defaultWeeklyReviewWeekId())?.view ??
      store.list()[0]?.view ??
      null
    )
  }

  const current = weekBoundsForAnchor()
  const previous = previousWeekBounds(current)
  const targets = [previous.id, current.id]
  if (store.shouldAutoGenerate()) {
    targets.unshift(current.id)
  }

  let latest: WeeklyReviewView | null = null
  for (const weekId of [...new Set(targets)]) {
    const existing = store.getByWeekId(weekId)
    // Only rebuild when missing (or forced).
    const shouldRefresh = options?.force || !existing
    if (shouldRefresh) {
      latest = buildAndSave(weekId)
    } else if (existing) {
      latest = existing.view
    }
  }

  return latest ?? store.list()[0]?.view ?? null
}

function scheduleEnsureWeeklyReviews(): void {
  const run = () => {
    ensureWeeklyReviews()
  }
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 1500 })
  } else {
    setTimeout(run, 0)
  }
}

export function useWeeklyReview(): {
  view: WeeklyReviewView
  weeks: ReturnType<typeof listRecentWeekBounds>
  selectedWeekId: string
  setSelectedWeekId: (id: string) => void
  regenerate: () => void
} {
  const version = useSyncExternalStore(subscribe, getVersion, () => 0)
  const hydrated = useHealthHydrated()
  const [tick, setTick] = useState(0)
  const selectedWeekId = useSyncExternalStore(
    (onChange) => getWeeklyReviewStore().subscribe(onChange),
    () =>
      getWeeklyReviewStore().getSelectedWeekId() ??
      defaultWeeklyReviewWeekId(),
    () => defaultWeeklyReviewWeekId()
  )

  useEffect(() => {
    getWeeklyReviewStore().hydrateFromStorage()
    getWorkoutStore().hydrateFromStorage()
    getNutritionStore().hydrateFromStorage()
    getBloodStore().hydrateFromStorage()
    getTreatmentStore().hydrateFromStorage()
    // Paint from cache immediately — never force-rebuild on open.
    setTick((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    scheduleEnsureWeeklyReviews()
  }, [hydrated])

  const weeks = useMemo(() => listRecentWeekBounds(16), [tick, version])

  const view = useMemo(() => {
    const store = getWeeklyReviewStore()
    store.hydrateFromStorage()
    const bounds =
      weeks.find((week) => week.id === selectedWeekId) ??
      weekBoundsForAnchor()

    const cached = store.getByWeekId(bounds.id)
    if (cached) return cached.view

    // Cheap empty placeholder until health hydrate + idle ensure run.
    if (!hydrated) {
      return buildWeeklyReview({
        records: [],
        bloodTests: [],
        nutritionDays: [],
        nutritionTargets: getNutritionStore().getTargets(),
        treatments: [],
        events: [],
        hevyWorkouts: [],
        bounds,
      })
    }

    const built = buildWeeklyReview({
      ...collectInput(),
      bounds,
    })
    store.save(built)
    return built
  }, [version, tick, selectedWeekId, weeks, hydrated])

  return {
    view,
    weeks,
    selectedWeekId,
    setSelectedWeekId: (id: string) =>
      getWeeklyReviewStore().setSelectedWeekId(id),
    regenerate: () => {
      buildAndSave(selectedWeekId)
      setTick((value) => value + 1)
    },
  }
}

/** Latest saved review for Mission Control / Coach surfaces. */
export function useLatestWeeklyReview(): WeeklyReviewView | null {
  // Always null on the server and on the client's first paint so SSR HTML
  // matches hydration. localStorage is read only after mount.
  const [review, setReview] = useState<WeeklyReviewView | null>(null)
  const hydrated = useHealthHydrated()

  useEffect(() => {
    function readLatest(): WeeklyReviewView | null {
      const store = getWeeklyReviewStore()
      store.hydrateFromStorage()
      const preferredId = defaultWeeklyReviewWeekId()
      return (
        store.getByWeekId(preferredId)?.view ?? store.list()[0]?.view ?? null
      )
    }

    getWeeklyReviewStore().hydrateFromStorage()
    setReview(readLatest())

    return getWeeklyReviewStore().subscribe(() => {
      setReview(readLatest())
    })
  }, [])

  useEffect(() => {
    if (!hydrated) return
    scheduleEnsureWeeklyReviews()
  }, [hydrated])

  return review
}
