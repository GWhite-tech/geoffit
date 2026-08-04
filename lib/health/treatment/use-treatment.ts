"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"

import { getBloodStore, getHealthStore } from "@/lib/health"
import { getTreatmentStore } from "@/lib/health/treatment/treatment-store"
import { buildTreatmentReminders } from "@/lib/health/treatment/reminders"
import { buildTreatmentAnalytics } from "@/lib/health/treatment/analytics"
import {
  daysRemainingSupply,
  enrichPeptideDose,
  formatDose,
  formatUnits,
  isScheduledOnDay,
  resolveCellState,
  todayKey,
  weekDates,
  type PlannerCellState,
} from "@/lib/health/treatment/calculations"
import type {
  Treatment,
  TreatmentCategory,
  WeekdayIndex,
} from "@/lib/domain/treatment"
import { TREATMENT_CATEGORY_LABELS } from "@/lib/domain/treatment"

function subscribe(onStoreChange: () => void) {
  const unsubTreatment = getTreatmentStore().subscribe(onStoreChange)
  const unsubHealth = getHealthStore().subscribe(onStoreChange)
  const unsubBlood = getBloodStore().subscribe(onStoreChange)
  return () => {
    unsubTreatment()
    unsubHealth()
    unsubBlood()
  }
}

function getVersion(): number {
  return (
    getTreatmentStore().getVersion() * 10_000 +
    getHealthStore().getRecordCount() * 10 +
    getBloodStore().getTestCount()
  )
}

function getServerVersion(): number {
  return 0
}

export function useTreatmentStoreVersion(): number {
  const version = useSyncExternalStore(subscribe, getVersion, getServerVersion)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    getTreatmentStore().hydrateFromStorage()
    void getHealthStore()
      .hydrateFromStorageAsync()
      .then(() => setTick((value) => value + 1))
    getBloodStore().hydrateFromStorage()
    setTick((value) => value + 1)
  }, [])

  return version + tick
}

export type TreatmentListItem = {
  treatment: Treatment
  doseLabel: string
  unitsLabel: string | null
  status: Treatment["status"]
  nextDoseLabel: string
  supplyLabel: string
  category: TreatmentCategory
}

export function useTreatmentNav(search: string) {
  const version = useTreatmentStoreVersion()

  return useMemo(() => {
    const store = getTreatmentStore()
    const treatments = store.getTreatments()
    const lots = store.getLots()
    const q = search.trim().toLowerCase()

    const items: TreatmentListItem[] = treatments
      .filter((treatment) => {
        if (!q) return true
        return (
          treatment.name.toLowerCase().includes(q) ||
          treatment.shortName.toLowerCase().includes(q) ||
          treatment.category.includes(q)
        )
      })
      .map((treatment) => {
        const peptide = enrichPeptideDose(treatment)
        const days = daysRemainingSupply(
          treatment,
          lots.filter((lot) => lot.treatmentId === treatment.id)
        )
        const next = treatment.schedules[0]
        return {
          treatment,
          doseLabel: formatDose(treatment.currentDose, treatment.doseUnit),
          unitsLabel: formatUnits(
            peptide.injectionUnits ?? treatment.injectionUnits
          ),
          status: treatment.status,
          nextDoseLabel: next ? next.time : "—",
          supplyLabel:
            days == null
              ? "—"
              : `${days}d left`,
          category: treatment.category,
        }
      })

    const order: TreatmentCategory[] = [
      "prescription",
      "peptide",
      "supplement",
      "injectable",
    ]

    return order
      .map((category) => ({
        id: category,
        label: TREATMENT_CATEGORY_LABELS[category],
        items: items.filter((item) => item.category === category),
      }))
      .filter((group) => group.items.length > 0)
  }, [version, search])
}

export type PlannerCell = {
  treatmentId: string
  date: string
  weekday: WeekdayIndex
  state: PlannerCellState
  doseLabel: string
  unitsLabel: string | null
  time: string | null
}

export type PlannerRow = {
  treatment: Treatment
  cells: PlannerCell[]
}

export function useWeeklyPlanner(anchor?: Date) {
  const version = useTreatmentStoreVersion()

  return useMemo(() => {
    const store = getTreatmentStore()
    const treatments = store
      .getTreatments()
      .filter((treatment) => treatment.status === "active")
    const events = store.getEvents()
    const dates = weekDates(anchor)
    const today = todayKey()

    const rows: PlannerRow[] = treatments.map((treatment) => {
      const peptide = enrichPeptideDose(treatment)
      const doseLabel = formatDose(treatment.currentDose, treatment.doseUnit)
      const unitsLabel = formatUnits(
        peptide.injectionUnits ?? treatment.injectionUnits
      )

      const cells = dates.map((date, index) => {
        const weekday = index as WeekdayIndex
        const resolved = resolveCellState(
          treatment,
          date,
          weekday,
          events,
          today
        )
        return {
          treatmentId: treatment.id,
          date,
          weekday,
          state: resolved.state,
          doseLabel,
          unitsLabel,
          time: resolved.slot?.time ?? null,
        } satisfies PlannerCell
      })

      return { treatment, cells }
    })

    return { dates, today, rows }
  }, [version, anchor])
}

export function useTodaySummary() {
  const version = useTreatmentStoreVersion()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [])

  return useMemo(() => {
    if (!ready) {
      return { todays: [], next: undefined, reminders: [] }
    }

    const store = getTreatmentStore()
    const treatments = store
      .getTreatments()
      .filter((treatment) => treatment.status === "active")
    const events = store.getEvents()
    const lots = store.getLots()
    const today = todayKey()
    const jsDay = new Date().getDay()
    const weekday = ((jsDay + 6) % 7) as WeekdayIndex

    const todays = treatments
      .map((treatment) => {
        const slots = isScheduledOnDay(treatment, weekday)
        if (slots.length === 0) return null
        const taken = events.some(
          (event) =>
            event.treatmentId === treatment.id &&
            event.date === today &&
            event.kind === "taken"
        )
        return {
          treatment,
          done: taken,
          time: slots[0]!.time,
        }
      })
      .filter(Boolean) as Array<{
      treatment: Treatment
      done: boolean
      time: string
    }>

    const next = todays
      .filter((item) => !item.done)
      .sort((a, b) => a.time.localeCompare(b.time))[0]

    const reminders = buildTreatmentReminders(treatments, lots)

    return {
      todays,
      next,
      reminders,
    }
  }, [version, ready])
}

export function useTreatmentDetail(treatmentId: string) {
  const version = useTreatmentStoreVersion()

  return useMemo(() => {
    const store = getTreatmentStore()
    const treatment = store.getTreatment(treatmentId)
    if (!treatment) return null
    const lots = store.getLotsFor(treatmentId)
    const events = store.getEventsFor(treatmentId)
    const analytics = buildTreatmentAnalytics(
      treatment,
      store.getEvents(),
      store.getLots(),
      getHealthStore().getAll(),
      getBloodStore().getAll()
    )
    const peptide = enrichPeptideDose(treatment)
    return {
      treatment,
      lots,
      events,
      analytics,
      peptide,
      reminders: buildTreatmentReminders([treatment], lots),
    }
  }, [version, treatmentId])
}

export function useDefaultTreatmentId(): string | null {
  const version = useTreatmentStoreVersion()
  return useMemo(() => {
    const active = getTreatmentStore()
      .getTreatments()
      .find((treatment) => treatment.status === "active")
    return active?.id ?? getTreatmentStore().getTreatments()[0]?.id ?? null
  }, [version])
}
