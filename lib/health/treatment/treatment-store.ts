import type {
  DoseEvent,
  DoseSchedule,
  InventoryLot,
  Treatment,
  TreatmentCategory,
  WeekdayIndex,
} from "@/lib/domain/treatment"
import {
  buildReconstitutionProfile,
  enrichPeptideDose,
  todayKey,
} from "@/lib/health/treatment/calculations"
import { createStarterTreatments } from "@/lib/health/treatment/seed"

export type CreateTreatmentInput = {
  name: string
  category: TreatmentCategory
  currentDose: number
  doseUnit: string
  /** YYYY-MM-DD — defaults to today when omitted. */
  startedAt?: string
  /** Empty daysOfWeek = every day. */
  daysOfWeek?: WeekdayIndex[]
  times?: string[]
  tabletsRemaining?: number
  prescriptionLeadTimeDays?: number
  vialStrengthMg?: number
  bacWaterMl?: number
  notes?: string
}

const STORAGE_KEY = "geoffit.treatment-store.v1"

type Listener = () => void

type PersistedShape = {
  version: number
  updatedAt: string
  treatments: Treatment[]
  lots: InventoryLot[]
  events: DoseEvent[]
  seeded?: boolean
}

/**
 * Central treatment read/write model.
 * Pure TypeScript — no React, no UI.
 */
export class TreatmentStore {
  private treatments: Treatment[] = []
  private lots: InventoryLot[] = []
  private events: DoseEvent[] = []
  private listeners = new Set<Listener>()
  private hydrated = false
  private seeded = false

  getTreatments(): Treatment[] {
    return this.treatments
  }

  getLots(): InventoryLot[] {
    return this.lots
  }

  getEvents(): DoseEvent[] {
    return this.events
  }

  getTreatment(id: string): Treatment | null {
    return this.treatments.find((item) => item.id === id) ?? null
  }

  getLotsFor(treatmentId: string): InventoryLot[] {
    return this.lots.filter((lot) => lot.treatmentId === treatmentId)
  }

  getEventsFor(treatmentId: string): DoseEvent[] {
    return this.events.filter((event) => event.treatmentId === treatmentId)
  }

  getVersion(): number {
    return (
      this.treatments.length * 1000 +
      this.lots.length * 100 +
      this.events.length
    )
  }

  createTreatment(input: CreateTreatmentInput): Treatment {
    const name = input.name.trim()
    if (!name) {
      throw new Error("Treatment name is required")
    }
    if (!(input.currentDose > 0) || !Number.isFinite(input.currentDose)) {
      throw new Error("Dose must be greater than zero")
    }

    const baseId = slugify(name)
    let id = baseId || `treatment-${Date.now()}`
    let suffix = 2
    while (this.treatments.some((item) => item.id === id)) {
      id = `${baseId}-${suffix}`
      suffix += 1
    }

    const times =
      input.times && input.times.length > 0 ? input.times : ["08:00"]
    const daysOfWeek = input.daysOfWeek ?? []
    const schedules: DoseSchedule[] = times.map((time, index) => ({
      daysOfWeek: [...daysOfWeek],
      time,
      label:
        times.length === 2
          ? index === 0
            ? "Morning"
            : "Evening"
          : times.length > 2
            ? `Dose ${index + 1}`
            : undefined,
    }))

    const isPeptide =
      input.category === "peptide" || input.category === "injectable"
    const reconstitution =
      isPeptide &&
      input.vialStrengthMg != null &&
      input.bacWaterMl != null &&
      input.vialStrengthMg > 0 &&
      input.bacWaterMl > 0
        ? buildReconstitutionProfile(input.vialStrengthMg, input.bacWaterMl, {
            storage: "fridge",
            openedDate: todayKey(),
          })
        : isPeptide
          ? buildReconstitutionProfile(10, 2, { storage: "fridge" })
          : undefined

    const maxSort = this.treatments.reduce(
      (max, item) => Math.max(max, item.sortOrder),
      0
    )

    const treatment: Treatment = {
      id,
      name,
      shortName: name,
      category: input.category,
      status: "active",
      doseUnit: input.doseUnit.trim() || defaultUnitForCategory(input.category),
      currentDose: input.currentDose,
      schedules,
      reconstitution,
      tabletsRemaining:
        input.category === "prescription" || input.category === "supplement"
          ? input.tabletsRemaining
          : undefined,
      dosesPerDay: times.length,
      prescriptionLeadTimeDays:
        input.category === "prescription"
          ? (input.prescriptionLeadTimeDays ?? 7)
          : undefined,
      startedAt: normalizeDate(input.startedAt) ?? todayKey(),
      notes: input.notes?.trim() || undefined,
      sortOrder: maxSort + 10,
      fingerprint: `treatment:${id}`,
    }

    this.upsertTreatment(treatment)

    const startDate = treatment.startedAt ?? todayKey()

    if (
      (input.category === "prescription" || input.category === "supplement") &&
      input.tabletsRemaining != null &&
      input.tabletsRemaining > 0
    ) {
      const lotId = `${id}-lot-1`
      this.upsertLot({
        id: lotId,
        treatmentId: id,
        receivedDate: startDate,
        storageLocation: "room_temperature",
        quantity: input.tabletsRemaining,
        quantityUnit: "tablets",
        status: "active",
        fingerprint: `lot:${lotId}`,
      })
    }

    if (isPeptide && reconstitution) {
      const lotId = `${id}-lot-active`
      this.upsertLot({
        id: lotId,
        treatmentId: id,
        receivedDate: startDate,
        storageLocation: "fridge",
        quantity: reconstitution.vialStrengthMg,
        quantityUnit: "mg",
        status: "active",
        reconstitution: {
          ...reconstitution,
          openedDate: reconstitution.openedDate ?? startDate,
        },
        fingerprint: `lot:${lotId}`,
      })
    }

    const eventId = `started-${id}`
    this.recordDoseEvent({
      id: eventId,
      treatmentId: id,
      kind: "note",
      date: startDate,
      recordedAt: new Date().toISOString(),
      dose: treatment.currentDose,
      doseUnit: treatment.doseUnit,
      notes: `Started ${treatment.name} at ${treatment.currentDose} ${treatment.doseUnit}`,
      fingerprint: eventId,
    })

    return this.getTreatment(id)!
  }

  /** Update treatment start date (YYYY-MM-DD). */
  updateStartedAt(treatmentId: string, startedAt: string): void {
    const existing = this.getTreatment(treatmentId)
    if (!existing) return
    const next = normalizeDate(startedAt)
    if (!next) return
    this.upsertTreatment({ ...existing, startedAt: next })
  }

  upsertTreatment(treatment: Treatment): void {
    const peptide = enrichPeptideDose(treatment)
    const next: Treatment = {
      ...treatment,
      injectionVolumeMl: peptide.injectionVolumeMl ?? treatment.injectionVolumeMl,
      injectionUnits: peptide.injectionUnits ?? treatment.injectionUnits,
      reconstitution: treatment.reconstitution
        ? {
            ...treatment.reconstitution,
            concentrationMgPerMl:
              peptide.concentrationMgPerMl ??
              treatment.reconstitution.concentrationMgPerMl,
          }
        : treatment.reconstitution,
    }
    const index = this.treatments.findIndex((item) => item.id === next.id)
    if (index >= 0) this.treatments[index] = next
    else this.treatments.push(next)
    this.treatments = [...this.treatments].sort(
      (a, b) => a.sortOrder - b.sortOrder
    )
    this.persist()
    this.emit()
  }

  /**
   * Update dose and/or schedule. Logs increased/reduced dose events when the
   * amount changes so history + timeline stay accurate.
   */
  updateDoseAndFrequency(
    treatmentId: string,
    patch: {
      currentDose: number
      schedules: Treatment["schedules"]
      dosesPerDay?: number
      /** YYYY-MM-DD — when the new dose took effect. Defaults to today. */
      effectiveDate?: string
    }
  ): void {
    const existing = this.getTreatment(treatmentId)
    if (!existing) return

    const previousDose = existing.currentDose
    const nextDose = patch.currentDose
    if (!(nextDose > 0) || !Number.isFinite(nextDose)) return

    this.upsertTreatment({
      ...existing,
      currentDose: nextDose,
      schedules: patch.schedules,
      dosesPerDay: patch.dosesPerDay ?? patch.schedules.length,
    })

    if (nextDose !== previousDose) {
      this.logDoseChange(treatmentId, {
        dose: nextDose,
        effectiveDate: patch.effectiveDate ?? todayKey(),
        previousDose,
        updateCurrent: false,
      })
    }
  }

  /**
   * Log a dosage change over time (historical or today).
   * Updates currentDose when this change is the latest on the timeline.
   */
  logDoseChange(
    treatmentId: string,
    input: {
      dose: number
      effectiveDate: string
      notes?: string
      previousDose?: number
      /** When false, caller already updated currentDose. Default true. */
      updateCurrent?: boolean
    }
  ): void {
    const existing = this.getTreatment(treatmentId)
    if (!existing) return
    const dose = input.dose
    if (!(dose > 0) || !Number.isFinite(dose)) return
    const effectiveDate = normalizeDate(input.effectiveDate)
    if (!effectiveDate) return

    const previous =
      input.previousDose ??
      doseBeforeDate(this.getEventsFor(treatmentId), existing, effectiveDate)
    if (previous === dose) return

    const kind = dose > previous ? "increased" : "reduced"
    const id = `dose-change-${treatmentId}-${effectiveDate}-${Date.now()}`
    const notes =
      input.notes?.trim() ||
      `${previous} → ${dose} ${existing.doseUnit}`

    this.recordDoseEvent({
      id,
      treatmentId,
      kind,
      date: effectiveDate,
      recordedAt: new Date().toISOString(),
      dose,
      doseUnit: existing.doseUnit,
      notes,
      fingerprint: id,
    })

    const updateCurrent = input.updateCurrent !== false
    if (updateCurrent) {
      const latest = latestDoseChange(
        this.getEventsFor(treatmentId),
        existing
      )
      // Only move currentDose when this change is the newest on the timeline.
      if (
        latest != null &&
        latest.dose === dose &&
        latest.date === effectiveDate
      ) {
        const fresh = this.getTreatment(treatmentId) ?? existing
        this.upsertTreatment({ ...fresh, currentDose: dose })
      }
    }
  }

  /** Chronological dose-change events (increased / reduced), oldest first. */
  getDoseChangeHistory(treatmentId: string): DoseEvent[] {
    return this.getEventsFor(treatmentId)
      .filter(
        (event) => event.kind === "increased" || event.kind === "reduced"
      )
      .sort((a, b) => {
        const byDate = a.date.localeCompare(b.date)
        if (byDate !== 0) return byDate
        return a.recordedAt.localeCompare(b.recordedAt)
      })
  }

  /**
   * Update peptide vial strength + bac water. Recalculates concentration,
   * injection volume, and insulin units. Syncs active/reconstituted lots.
   */
  updateReconstitution(
    treatmentId: string,
    patch: {
      vialStrengthMg: number
      bacWaterMl: number
    }
  ): void {
    const existing = this.getTreatment(treatmentId)
    if (!existing) return
    if (!(patch.vialStrengthMg > 0) || !(patch.bacWaterMl > 0)) return

    const previous = existing.reconstitution
    const reconstitution = buildReconstitutionProfile(
      patch.vialStrengthMg,
      patch.bacWaterMl,
      {
        storage: previous?.storage ?? "fridge",
        openedDate: previous?.openedDate,
        discardAfter: previous?.discardAfter,
      }
    )

    this.lots = this.lots.map((lot) => {
      if (
        lot.treatmentId !== treatmentId ||
        !["active", "reconstituted", "ready", "fridge", "frozen"].includes(
          lot.status
        )
      ) {
        return lot
      }
      return {
        ...lot,
        reconstitution: {
          ...reconstitution,
          storage: lot.reconstitution?.storage ?? reconstitution.storage,
          openedDate: lot.reconstitution?.openedDate,
          discardAfter: lot.reconstitution?.discardAfter,
        },
      }
    })

    this.upsertTreatment({
      ...existing,
      reconstitution,
    })

    if (
      !previous ||
      previous.vialStrengthMg !== patch.vialStrengthMg ||
      previous.bacWaterMl !== patch.bacWaterMl
    ) {
      const id = `recon-${treatmentId}-${Date.now()}`
      this.recordDoseEvent({
        id,
        treatmentId,
        kind: "note",
        date: todayKey(),
        recordedAt: new Date().toISOString(),
        notes: `Reconstitution updated · ${patch.vialStrengthMg} mg / ${patch.bacWaterMl} ml bac water`,
        fingerprint: id,
      })
    }
  }

  upsertLot(lot: InventoryLot): void {
    const index = this.lots.findIndex((item) => item.id === lot.id)
    if (index >= 0) this.lots[index] = lot
    else this.lots.push(lot)
    this.lots = [...this.lots]
    this.persist()
    this.emit()
  }

  recordDoseEvent(event: DoseEvent): void {
    const without = this.events.filter(
      (item) => item.fingerprint !== event.fingerprint
    )
    this.events = [...without, event].sort((a, b) =>
      b.recordedAt.localeCompare(a.recordedAt)
    )
    this.persist()
    this.emit()
  }

  /** Toggle planner cell: taken ↔ clear (re-schedule). */
  toggleDoseTaken(
    treatmentId: string,
    date: string,
    scheduledTime?: string
  ): void {
    const treatment = this.getTreatment(treatmentId)
    if (!treatment) return

    const existing = this.events.find(
      (event) =>
        event.treatmentId === treatmentId &&
        event.date === date &&
        event.kind === "taken" &&
        (scheduledTime == null || event.scheduledTime === scheduledTime)
    )

    if (existing) {
      this.events = this.events.filter((event) => event.id !== existing.id)
      this.persist()
      this.emit()
      return
    }

    // Remove missed/skipped for that slot, then mark taken.
    this.events = this.events.filter(
      (event) =>
        !(
          event.treatmentId === treatmentId &&
          event.date === date &&
          (event.kind === "missed" || event.kind === "skipped") &&
          (scheduledTime == null || event.scheduledTime === scheduledTime)
        )
    )

    const peptide = enrichPeptideDose(treatment)
    const id = `dose-${treatmentId}-${date}-${scheduledTime ?? "any"}`
    this.recordDoseEvent({
      id,
      treatmentId,
      kind: "taken",
      date,
      scheduledTime,
      recordedAt: new Date().toISOString(),
      dose: treatment.currentDose,
      doseUnit: treatment.doseUnit,
      injectionUnits: peptide.injectionUnits ?? treatment.injectionUnits,
      fingerprint: id,
    })
  }

  markMissed(treatmentId: string, date: string, scheduledTime?: string): void {
    const id = `missed-${treatmentId}-${date}-${scheduledTime ?? "any"}`
    this.recordDoseEvent({
      id,
      treatmentId,
      kind: "missed",
      date,
      scheduledTime,
      recordedAt: new Date().toISOString(),
      fingerprint: id,
    })
  }

  moveLotToFridge(lotId: string): void {
    const lot = this.lots.find((item) => item.id === lotId)
    if (!lot) return
    this.upsertLot({
      ...lot,
      status: "fridge",
      storageLocation: "fridge",
    })
    this.recordDoseEvent({
      id: `moved-${lotId}-${Date.now()}`,
      treatmentId: lot.treatmentId,
      kind: "moved_to_fridge",
      date: todayKey(),
      recordedAt: new Date().toISOString(),
      lotId,
      fingerprint: `moved:${lotId}:${todayKey()}`,
    })
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  hydrateFromStorage(): void {
    if (typeof window === "undefined" || this.hydrated) return
    this.hydrated = true
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedShape
        this.treatments = Array.isArray(parsed.treatments)
          ? parsed.treatments
          : []
        this.lots = Array.isArray(parsed.lots) ? parsed.lots : []
        this.events = Array.isArray(parsed.events) ? parsed.events : []
        this.seeded = Boolean(parsed.seeded)
      }
    } catch {
      // ignore corrupt storage
    }

    if (!this.seeded && this.treatments.length === 0) {
      const starter = createStarterTreatments()
      this.treatments = starter.treatments
      this.lots = starter.lots
      this.seeded = true
      this.persist()
    }

    this.emit()
  }

  private persist(): void {
    if (typeof window === "undefined") return
    try {
      const payload: PersistedShape = {
        version: 1,
        updatedAt: new Date().toISOString(),
        treatments: this.treatments,
        lots: this.lots,
        events: this.events,
        seeded: this.seeded,
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // quota / private mode
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

let singleton: TreatmentStore | null = null

export function getTreatmentStore(): TreatmentStore {
  if (!singleton) singleton = new TreatmentStore()
  return singleton
}

export function resetTreatmentStore(): void {
  singleton = null
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function defaultUnitForCategory(category: TreatmentCategory): string {
  if (category === "supplement") return "IU"
  return "mg"
}

function normalizeDate(value: string | undefined): string | null {
  if (!value) return null
  const key = value.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null
  const time = Date.parse(`${key}T12:00:00.000Z`)
  if (Number.isNaN(time)) return null
  return key
}

function isDoseChange(event: DoseEvent): boolean {
  return event.kind === "increased" || event.kind === "reduced"
}

/** Dose in effect immediately before `date` (exclusive). */
function doseBeforeDate(
  events: DoseEvent[],
  treatment: Treatment,
  date: string
): number {
  const prior = events
    .filter(
      (event) =>
        isDoseChange(event) &&
        event.date < date &&
        event.dose != null &&
        Number.isFinite(event.dose)
    )
    .sort((a, b) => {
      const byDate = b.date.localeCompare(a.date)
      if (byDate !== 0) return byDate
      return b.recordedAt.localeCompare(a.recordedAt)
    })
  if (prior[0]?.dose != null) return prior[0].dose
  return treatment.currentDose
}

function latestDoseChange(
  events: DoseEvent[],
  treatment: Treatment
): { dose: number; date: string } | null {
  const changes = events
    .filter(
      (event) =>
        isDoseChange(event) &&
        event.dose != null &&
        Number.isFinite(event.dose)
    )
    .sort((a, b) => {
      const byDate = b.date.localeCompare(a.date)
      if (byDate !== 0) return byDate
      return b.recordedAt.localeCompare(a.recordedAt)
    })
  if (changes[0]?.dose != null) {
    return { dose: changes[0].dose, date: changes[0].date }
  }
  if (treatment.currentDose > 0) {
    return {
      dose: treatment.currentDose,
      date: treatment.startedAt ?? todayKey(),
    }
  }
  return null
}
