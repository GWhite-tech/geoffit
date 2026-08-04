/**
 * Geoffit treatment domain — medicines, peptides, supplements, injectables.
 * Importers / UI map here before persistence. No React.
 */

export type TreatmentCategory =
  | "prescription"
  | "peptide"
  | "supplement"
  | "injectable"

export type TreatmentStatus =
  | "active"
  | "paused"
  | "completed"
  | "discontinued"

export type StorageLocation =
  | "freezer"
  | "fridge"
  | "room_temperature"
  | "travel"

export type InventoryLotStatus =
  | "frozen"
  | "fridge"
  | "ready"
  | "reconstituted"
  | "active"
  | "finished"
  | "discarded"

export type DoseEventKind =
  | "taken"
  | "missed"
  | "skipped"
  | "increased"
  | "reduced"
  | "paused"
  | "restarted"
  | "opened_vial"
  | "moved_to_fridge"
  | "finished_vial"
  | "prescription_collected"
  | "note"

export type ReminderKind =
  | "dose_due"
  | "prescription_renewal"
  | "inventory_low"
  | "vial_almost_empty"
  | "move_to_fridge"
  | "discard_expired"

/** Monday = 0 … Sunday = 6 (planner-first week). */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface DoseSchedule {
  /** Days of the week this dose applies. Empty = every day. */
  daysOfWeek: WeekdayIndex[]
  /** Local time HH:mm */
  time: string
  label?: string
}

export interface ReconstitutionProfile {
  vialStrengthMg: number
  bacWaterMl: number
  /** Derived: mg/ml */
  concentrationMgPerMl: number
  openedDate?: string
  /** ISO date — discard reconstituted vial after this day. */
  discardAfter?: string
  storage: StorageLocation
}

export interface InventoryLot {
  id: string
  treatmentId: string
  batchNumber?: string
  supplier?: string
  receivedDate: string
  expiry?: string
  storageLocation: StorageLocation
  /** Units depend on treatment form: tablets, vials, or mg remaining. */
  quantity: number
  quantityUnit: "tablets" | "vials" | "mg" | "ml"
  status: InventoryLotStatus
  reconstitution?: ReconstitutionProfile
  notes?: string
  fingerprint: string
}

export interface Treatment {
  id: string
  name: string
  shortName: string
  category: TreatmentCategory
  status: TreatmentStatus
  /** Display unit for the current dose (mg, mcg, tablets, IU…). */
  doseUnit: string
  currentDose: number
  /** Injection syringe units when applicable (U-100). */
  injectionUnits?: number
  /** Computed injection volume in ml when peptide/injectable. */
  injectionVolumeMl?: number
  schedules: DoseSchedule[]
  reconstitution?: ReconstitutionProfile
  /** Tablets / oral inventory helpers. */
  tabletsRemaining?: number
  dosesPerDay?: number
  /** Days before supply runs out to request a repeat. */
  prescriptionLeadTimeDays?: number
  startedAt?: string
  notes?: string
  color?: string
  sortOrder: number
  fingerprint: string
}

export interface DoseEvent {
  id: string
  treatmentId: string
  kind: DoseEventKind
  /** Calendar day the dose belongs to (YYYY-MM-DD). */
  date: string
  /** Optional scheduled time HH:mm */
  scheduledTime?: string
  /** When the event was recorded (ISO). */
  recordedAt: string
  dose?: number
  doseUnit?: string
  injectionUnits?: number
  notes?: string
  lotId?: string
  fingerprint: string
}

export interface Reminder {
  id: string
  treatmentId?: string
  kind: ReminderKind
  title: string
  detail: string
  dueDate: string
  dismissed?: boolean
  fingerprint: string
}

export const TREATMENT_CATEGORY_LABELS: Record<TreatmentCategory, string> = {
  prescription: "Prescription",
  peptide: "Peptides",
  supplement: "Supplements",
  injectable: "Injectables",
}

export const TREATMENT_STATUS_LABELS: Record<TreatmentStatus, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  discontinued: "Discontinued",
}

export const INVENTORY_STATUS_LABELS: Record<InventoryLotStatus, string> = {
  frozen: "Frozen",
  fridge: "Fridge",
  ready: "Ready to use",
  reconstituted: "Reconstituted",
  active: "Active vial",
  finished: "Finished",
  discarded: "Discarded",
}

export const STORAGE_LOCATION_LABELS: Record<StorageLocation, string> = {
  freezer: "Freezer",
  fridge: "Fridge",
  room_temperature: "Room temperature",
  travel: "Travel",
}

export const DOSE_EVENT_LABELS: Record<DoseEventKind, string> = {
  taken: "Dose taken",
  missed: "Dose missed",
  skipped: "Dose skipped",
  increased: "Dose increased",
  reduced: "Dose reduced",
  paused: "Paused",
  restarted: "Restarted",
  opened_vial: "Opened new vial",
  moved_to_fridge: "Moved vial to fridge",
  finished_vial: "Finished vial",
  prescription_collected: "Collected prescription",
  note: "Note",
}

export const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const
