import type {
  DoseEvent,
  InventoryLot,
  ReconstitutionProfile,
  Treatment,
  WeekdayIndex,
} from "@/lib/domain/treatment"

/** U-100 insulin syringe: 100 units = 1 ml. */
export const INSULIN_UNITS_PER_ML = 100

export function calculateConcentration(
  vialStrengthMg: number,
  bacWaterMl: number
): number {
  if (!(bacWaterMl > 0)) return 0
  return vialStrengthMg / bacWaterMl
}

export function calculateInjectionVolumeMl(
  doseMg: number,
  concentrationMgPerMl: number
): number {
  if (!(concentrationMgPerMl > 0)) return 0
  return doseMg / concentrationMgPerMl
}

export function calculateInsulinUnits(injectionVolumeMl: number): number {
  return injectionVolumeMl * INSULIN_UNITS_PER_ML
}

export function buildReconstitutionProfile(
  vialStrengthMg: number,
  bacWaterMl: number,
  extras: Partial<
    Omit<
      ReconstitutionProfile,
      "vialStrengthMg" | "bacWaterMl" | "concentrationMgPerMl"
    >
  > = {}
): ReconstitutionProfile {
  return {
    vialStrengthMg,
    bacWaterMl,
    concentrationMgPerMl: calculateConcentration(vialStrengthMg, bacWaterMl),
    storage: extras.storage ?? "fridge",
    openedDate: extras.openedDate,
    discardAfter: extras.discardAfter,
  }
}

export function enrichPeptideDose(treatment: Treatment): {
  concentrationMgPerMl: number | null
  injectionVolumeMl: number | null
  injectionUnits: number | null
} {
  const recon = treatment.reconstitution
  if (!recon) {
    return {
      concentrationMgPerMl: null,
      injectionVolumeMl: treatment.injectionVolumeMl ?? null,
      injectionUnits: treatment.injectionUnits ?? null,
    }
  }
  const concentration =
    recon.concentrationMgPerMl ||
    calculateConcentration(recon.vialStrengthMg, recon.bacWaterMl)
  const volume = calculateInjectionVolumeMl(treatment.currentDose, concentration)
  const units = calculateInsulinUnits(volume)
  return {
    concentrationMgPerMl: concentration,
    injectionVolumeMl: volume,
    injectionUnits: units,
  }
}

export function remainingMgFromLots(lots: InventoryLot[]): number {
  return lots
    .filter((lot) =>
      ["active", "reconstituted", "ready", "fridge", "frozen"].includes(
        lot.status
      )
    )
    .reduce((sum, lot) => {
      if (lot.quantityUnit === "mg") return sum + lot.quantity
      if (lot.reconstitution && lot.quantityUnit === "vials") {
        return sum + lot.reconstitution.vialStrengthMg * lot.quantity
      }
      if (lot.reconstitution && lot.status === "active") {
        return sum + (lot.quantityUnit === "ml"
          ? lot.quantity * lot.reconstitution.concentrationMgPerMl
          : lot.quantity)
      }
      return sum
    }, 0)
}

export function remainingInjections(
  remainingMg: number,
  doseMg: number
): number | null {
  if (!(doseMg > 0)) return null
  return Math.floor(remainingMg / doseMg)
}

export function dosesPerCalendarDay(treatment: Treatment): number {
  if (treatment.dosesPerDay != null && treatment.dosesPerDay > 0) {
    return treatment.dosesPerDay
  }
  if (treatment.schedules.length === 0) return 1
  // Average scheduled slots across a week.
  const slots = treatment.schedules.reduce((sum, schedule) => {
    const days =
      schedule.daysOfWeek.length === 0 ? 7 : schedule.daysOfWeek.length
    return sum + days / 7
  }, 0)
  return Math.max(slots, 0.1)
}

export function daysRemainingSupply(
  treatment: Treatment,
  lots: InventoryLot[]
): number | null {
  if (
    treatment.category === "prescription" ||
    treatment.category === "supplement"
  ) {
    const tablets = treatment.tabletsRemaining
    if (tablets == null) return null
    // Each scheduled oral dose consumes one tablet/capsule.
    const perDay = dosesPerCalendarDay(treatment)
    if (!(perDay > 0)) return null
    return Math.floor(tablets / perDay)
  }

  const remainingMg = remainingMgFromLots(
    lots.filter((lot) => lot.treatmentId === treatment.id)
  )
  const dosePerDay = dosesPerCalendarDay(treatment) * treatment.currentDose
  if (!(dosePerDay > 0) || remainingMg <= 0) return null
  return Math.floor(remainingMg / dosePerDay)
}

export function projectedFinishDate(
  daysRemaining: number | null,
  from = new Date()
): string | null {
  if (daysRemaining == null || daysRemaining < 0) return null
  const date = new Date(from)
  date.setDate(date.getDate() + daysRemaining)
  return date.toISOString().slice(0, 10)
}

export function prescriptionRequestInDays(
  daysRemaining: number | null,
  leadTimeDays: number | undefined
): number | null {
  if (daysRemaining == null) return null
  const lead = leadTimeDays ?? 7
  return daysRemaining - lead
}

export function isScheduledOnDay(
  treatment: Treatment,
  weekday: WeekdayIndex
): DoseScheduleSlot[] {
  const slots: DoseScheduleSlot[] = []
  for (const schedule of treatment.schedules) {
    const days = schedule.daysOfWeek
    if (days.length === 0 || days.includes(weekday)) {
      slots.push({
        time: schedule.time,
        label: schedule.label,
      })
    }
  }
  return slots.sort((a, b) => a.time.localeCompare(b.time))
}

export type DoseScheduleSlot = {
  time: string
  label?: string
}

export type PlannerCellState = "scheduled" | "taken" | "missed" | "skipped" | "empty"

export function resolveCellState(
  treatment: Treatment,
  date: string,
  weekday: WeekdayIndex,
  events: DoseEvent[],
  today: string
): {
  state: PlannerCellState
  slot: DoseScheduleSlot | null
  event: DoseEvent | null
} {
  const slots = isScheduledOnDay(treatment, weekday)
  if (slots.length === 0 || treatment.status !== "active") {
    return { state: "empty", slot: null, event: null }
  }

  const slot = slots[0]!
  const dayEvents = events.filter(
    (event) =>
      event.treatmentId === treatment.id &&
      event.date === date &&
      (event.kind === "taken" ||
        event.kind === "missed" ||
        event.kind === "skipped")
  )
  const taken = dayEvents.find((event) => event.kind === "taken")
  if (taken) return { state: "taken", slot, event: taken }

  const skipped = dayEvents.find((event) => event.kind === "skipped")
  if (skipped) return { state: "skipped", slot, event: skipped }

  const missed = dayEvents.find((event) => event.kind === "missed")
  if (missed) return { state: "missed", slot, event: missed }

  if (date < today) return { state: "missed", slot, event: null }
  return { state: "scheduled", slot, event: null }
}

export function adherencePercent(
  treatment: Treatment,
  events: DoseEvent[],
  fromDate: string,
  toDate: string
): number | null {
  const scheduled = countScheduledDays(treatment, fromDate, toDate)
  if (scheduled === 0) return null
  const taken = events.filter(
    (event) =>
      event.treatmentId === treatment.id &&
      event.kind === "taken" &&
      event.date >= fromDate &&
      event.date <= toDate
  ).length
  return Math.round((taken / scheduled) * 100)
}

function countScheduledDays(
  treatment: Treatment,
  fromDate: string,
  toDate: string
): number {
  let count = 0
  const cursor = new Date(`${fromDate}T12:00:00`)
  const end = new Date(`${toDate}T12:00:00`)
  while (cursor <= end) {
    const jsDay = cursor.getDay()
    const weekday = ((jsDay + 6) % 7) as WeekdayIndex
    if (isScheduledOnDay(treatment, weekday).length > 0) count += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

/** Monday-start ISO week containing `anchor`. */
export function weekDates(anchor: Date = new Date()): string[] {
  const date = new Date(anchor)
  date.setHours(12, 0, 0, 0)
  const jsDay = date.getDay()
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay
  date.setDate(date.getDate() + mondayOffset)
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(date)
    day.setDate(date.getDate() + index)
    return day.toISOString().slice(0, 10)
  })
}

export function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function formatDose(value: number, unit: string, decimals = 2): string {
  const formatted =
    decimals === 0
      ? Math.round(value).toString()
      : value.toFixed(decimals).replace(/\.?0+$/, "")
  return unit ? `${formatted} ${unit}` : formatted
}

export function formatUnits(units: number | null | undefined): string | null {
  if (units == null || !Number.isFinite(units)) return null
  const rounded = Math.round(units * 10) / 10
  return `${rounded} units`
}
