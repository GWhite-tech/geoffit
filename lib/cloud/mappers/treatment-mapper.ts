/**
 * Treatment domain ↔ treatments / treatment_lots / treatment_dose_events.
 * Cloud fingerprints computed here; TreatmentStore fingerprints unchanged.
 */

import type {
  DoseEvent,
  InventoryLot,
  Treatment,
} from "@/lib/domain/treatment"

import type { SharedFactColumns, WriteContext } from "../types"
import {
  treatmentCloudFingerprint,
  treatmentDoseCloudFingerprint,
  treatmentLotCloudFingerprint,
} from "./fingerprints"
import { sharedInsertFields, sharedUpdateFields } from "./shared"

export type TreatmentRow = SharedFactColumns & {
  name: string
  short_name: string
  category: string
  status: string
  dose_unit: string
  current_dose: number
  sort_order: number
  started_at: string | null
  notes: string | null
}

export type TreatmentLotRow = SharedFactColumns & {
  treatment_id: string
  batch_number: string | null
  supplier: string | null
  received_date: string | null
  expiry: string | null
  storage_location: string | null
  quantity: number
  quantity_unit: string
  status: string
  notes: string | null
}

export type TreatmentDoseEventRow = SharedFactColumns & {
  treatment_id: string
  lot_id: string | null
  kind: string
  event_date: string
  scheduled_time: string | null
  recorded_at: string
  dose: number | null
  dose_unit: string | null
  injection_units: number | null
  notes: string | null
}

export function treatmentToInsertRow(
  treatment: Treatment,
  ctx: WriteContext
): Omit<TreatmentRow, "id" | "created_at" | "updated_at" | "deleted_at"> & {
  cloudFingerprint: string
} {
  const cloudFingerprint = treatmentCloudFingerprint({
    name: treatment.name,
    localId: treatment.id,
  })
  return {
    cloudFingerprint,
    ...sharedInsertFields(ctx, {
      fingerprint: cloudFingerprint,
      source: "manual",
      sourceName: null,
      payload: {
        local_id: treatment.id,
        local_fingerprint: treatment.fingerprint,
        schedules: treatment.schedules,
        reconstitution: treatment.reconstitution,
        color: treatment.color,
        tabletsRemaining: treatment.tabletsRemaining,
        dosesPerDay: treatment.dosesPerDay,
        prescriptionLeadTimeDays: treatment.prescriptionLeadTimeDays,
        injectionUnits: treatment.injectionUnits,
        injectionVolumeMl: treatment.injectionVolumeMl,
      },
    }),
    name: treatment.name,
    short_name: treatment.shortName,
    category: treatment.category,
    status: treatment.status,
    dose_unit: treatment.doseUnit,
    current_dose: treatment.currentDose,
    sort_order: treatment.sortOrder,
    started_at: treatment.startedAt?.slice(0, 10) ?? null,
    notes: treatment.notes ?? null,
  }
}

export function treatmentToUpdatePatch(
  treatment: Treatment,
  existingRevision: number,
  ctx: WriteContext
): Partial<TreatmentRow> {
  const insertLike = treatmentToInsertRow(treatment, ctx)
  return {
    ...sharedUpdateFields(existingRevision, ctx, {
      source: "manual",
      sourceName: null,
      payload: insertLike.payload,
    }),
    name: insertLike.name,
    short_name: insertLike.short_name,
    category: insertLike.category,
    status: insertLike.status,
    dose_unit: insertLike.dose_unit,
    current_dose: insertLike.current_dose,
    sort_order: insertLike.sort_order,
    started_at: insertLike.started_at,
    notes: insertLike.notes,
  }
}

export function treatmentLotToInsertRow(
  lot: InventoryLot,
  treatmentCloudFp: string,
  treatmentId: string,
  ctx: WriteContext
): Omit<TreatmentLotRow, "id" | "created_at" | "updated_at" | "deleted_at"> {
  const fingerprint = treatmentLotCloudFingerprint({
    treatmentFingerprint: treatmentCloudFp,
    localId: lot.id,
    batchNumber: lot.batchNumber,
    receivedDate: lot.receivedDate,
    status: lot.status,
  })
  return {
    ...sharedInsertFields(ctx, {
      fingerprint,
      source: "manual",
      payload: {
        local_id: lot.id,
        local_fingerprint: lot.fingerprint,
        reconstitution: lot.reconstitution,
        treatment_local_id: lot.treatmentId,
      },
    }),
    treatment_id: treatmentId,
    batch_number: lot.batchNumber ?? null,
    supplier: lot.supplier ?? null,
    received_date: lot.receivedDate?.slice(0, 10) ?? null,
    expiry: lot.expiry?.slice(0, 10) ?? null,
    storage_location: lot.storageLocation ?? null,
    quantity: lot.quantity,
    quantity_unit: lot.quantityUnit,
    status: lot.status,
    notes: lot.notes ?? null,
  }
}

export function treatmentDoseToInsertRow(
  event: DoseEvent,
  treatmentCloudFp: string,
  treatmentId: string,
  lotId: string | null,
  ctx: WriteContext
): Omit<
  TreatmentDoseEventRow,
  "id" | "created_at" | "updated_at" | "deleted_at"
> {
  const fingerprint = treatmentDoseCloudFingerprint({
    treatmentFingerprint: treatmentCloudFp,
    kind: event.kind,
    eventDate: event.date,
    scheduledTime: event.scheduledTime,
    dose: event.dose,
    localFingerprint: event.fingerprint,
  })
  return {
    ...sharedInsertFields(ctx, {
      fingerprint,
      source: "manual",
      payload: {
        local_id: event.id,
        local_fingerprint: event.fingerprint,
        treatment_local_id: event.treatmentId,
        lot_local_id: event.lotId,
      },
    }),
    treatment_id: treatmentId,
    lot_id: lotId,
    kind: event.kind,
    event_date: event.date.slice(0, 10),
    scheduled_time: event.scheduledTime ?? null,
    recorded_at: event.recordedAt,
    dose: event.dose ?? null,
    dose_unit: event.doseUnit ?? null,
    injection_units: event.injectionUnits ?? null,
    notes: event.notes ?? null,
  }
}

export function treatmentFromRow(row: TreatmentRow): Treatment {
  const localId =
    typeof row.payload.local_id === "string" ? row.payload.local_id : row.id
  const localFingerprint =
    typeof row.payload.local_fingerprint === "string"
      ? row.payload.local_fingerprint
      : row.fingerprint
  return {
    id: localId,
    name: row.name,
    shortName: row.short_name,
    category: row.category as Treatment["category"],
    status: row.status as Treatment["status"],
    doseUnit: row.dose_unit,
    currentDose: row.current_dose,
    sortOrder: row.sort_order,
    startedAt: row.started_at ?? undefined,
    notes: row.notes ?? undefined,
    fingerprint: localFingerprint,
    schedules: Array.isArray(row.payload.schedules)
      ? (row.payload.schedules as Treatment["schedules"])
      : [],
    reconstitution: row.payload.reconstitution as Treatment["reconstitution"],
    color: typeof row.payload.color === "string" ? row.payload.color : undefined,
    tabletsRemaining:
      typeof row.payload.tabletsRemaining === "number"
        ? row.payload.tabletsRemaining
        : undefined,
    dosesPerDay:
      typeof row.payload.dosesPerDay === "number"
        ? row.payload.dosesPerDay
        : undefined,
    prescriptionLeadTimeDays:
      typeof row.payload.prescriptionLeadTimeDays === "number"
        ? row.payload.prescriptionLeadTimeDays
        : undefined,
    injectionUnits:
      typeof row.payload.injectionUnits === "number"
        ? row.payload.injectionUnits
        : undefined,
    injectionVolumeMl:
      typeof row.payload.injectionVolumeMl === "number"
        ? row.payload.injectionVolumeMl
        : undefined,
  }
}

export function treatmentLotFromRow(
  row: TreatmentLotRow,
  treatmentLocalId: string
): InventoryLot {
  const localId =
    typeof row.payload.local_id === "string" ? row.payload.local_id : row.id
  const localFingerprint =
    typeof row.payload.local_fingerprint === "string"
      ? row.payload.local_fingerprint
      : row.fingerprint
  return {
    id: localId,
    treatmentId: treatmentLocalId,
    batchNumber: row.batch_number ?? undefined,
    supplier: row.supplier ?? undefined,
    receivedDate: row.received_date ?? new Date().toISOString().slice(0, 10),
    expiry: row.expiry ?? undefined,
    storageLocation:
      (row.storage_location as InventoryLot["storageLocation"]) ?? "fridge",
    quantity: row.quantity,
    quantityUnit: (row.quantity_unit as InventoryLot["quantityUnit"]) || "vials",
    status: row.status as InventoryLot["status"],
    notes: row.notes ?? undefined,
    fingerprint: localFingerprint,
    reconstitution: row.payload.reconstitution as InventoryLot["reconstitution"],
  }
}

export function treatmentDoseFromRow(
  row: TreatmentDoseEventRow,
  treatmentLocalId: string
): DoseEvent {
  const localId =
    typeof row.payload.local_id === "string" ? row.payload.local_id : row.id
  const localFingerprint =
    typeof row.payload.local_fingerprint === "string"
      ? row.payload.local_fingerprint
      : row.fingerprint
  const lotLocalId =
    typeof row.payload.lot_local_id === "string"
      ? row.payload.lot_local_id
      : undefined
  return {
    id: localId,
    treatmentId: treatmentLocalId,
    kind: row.kind as DoseEvent["kind"],
    date: row.event_date,
    scheduledTime: row.scheduled_time ?? undefined,
    recordedAt: row.recorded_at,
    dose: row.dose ?? undefined,
    doseUnit: row.dose_unit ?? undefined,
    injectionUnits: row.injection_units ?? undefined,
    notes: row.notes ?? undefined,
    lotId: lotLocalId,
    fingerprint: localFingerprint,
  }
}
