/**
 * BloodTest ↔ blood_panels + blood_results (PR2).
 */

import type { BloodMarker, BloodMarkerStatus, BloodTest } from "@/lib/domain/blood"

import type { SharedFactColumns, WriteContext } from "../types"
import { sharedInsertFields, sharedUpdateFields } from "./shared"

export type BloodPanelRow = SharedFactColumns & {
  provider: string
  panel_name: string
  test_date: string
  exported_at: string | null
  patient_name: string | null
  sex: string | null
  clinical_review: string | null
  source_file_name: string
}

export type BloodResultRow = SharedFactColumns & {
  panel_id: string
  marker_key: string
  name: string
  value: number
  unit: string
  reference_low: number | null
  reference_high: number | null
  reference_text: string | null
  status: string
}

function panelPayload(test: BloodTest): Record<string, unknown> {
  return { local_id: test.id }
}

function markerPayload(marker: BloodMarker): Record<string, unknown> {
  return { local_id: marker.id }
}

export function bloodPanelToInsertRow(
  test: BloodTest,
  ctx: WriteContext
): Omit<BloodPanelRow, "id" | "created_at" | "updated_at" | "deleted_at"> {
  return {
    ...sharedInsertFields(ctx, {
      fingerprint: test.fingerprint,
      source: test.source || "blood_pdf",
      sourceName: test.provider || null,
      payload: panelPayload(test),
    }),
    provider: test.provider,
    panel_name: test.panelName,
    test_date: test.testDate.slice(0, 10),
    exported_at: test.exportedAt ?? null,
    patient_name: test.patientName ?? null,
    sex: test.sex ?? null,
    clinical_review: test.clinicalReview ?? null,
    source_file_name: test.sourceFileName,
  }
}

export function bloodPanelToUpdatePatch(
  test: BloodTest,
  existingRevision: number,
  ctx: WriteContext
): Partial<BloodPanelRow> {
  const insertLike = bloodPanelToInsertRow(test, ctx)
  return {
    ...sharedUpdateFields(existingRevision, ctx, {
      source: test.source || "blood_pdf",
      sourceName: test.provider || null,
      payload: panelPayload(test),
    }),
    provider: insertLike.provider,
    panel_name: insertLike.panel_name,
    test_date: insertLike.test_date,
    exported_at: insertLike.exported_at,
    patient_name: insertLike.patient_name,
    sex: insertLike.sex,
    clinical_review: insertLike.clinical_review,
    source_file_name: insertLike.source_file_name,
  }
}

export function bloodResultToInsertRow(
  test: BloodTest,
  marker: BloodMarker,
  panelId: string,
  ctx: WriteContext
): Omit<BloodResultRow, "id" | "created_at" | "updated_at" | "deleted_at"> {
  return {
    ...sharedInsertFields(ctx, {
      fingerprint: marker.fingerprint,
      source: test.source || "blood_pdf",
      sourceName: test.provider || null,
      payload: markerPayload(marker),
    }),
    panel_id: panelId,
    marker_key: marker.key,
    name: marker.name,
    value: marker.value,
    unit: marker.unit,
    reference_low: marker.referenceRange.low ?? null,
    reference_high: marker.referenceRange.high ?? null,
    reference_text: marker.referenceRange.text ?? null,
    status: marker.status,
  }
}

export function bloodResultToUpdatePatch(
  test: BloodTest,
  marker: BloodMarker,
  panelId: string,
  existingRevision: number,
  ctx: WriteContext
): Partial<BloodResultRow> {
  const insertLike = bloodResultToInsertRow(test, marker, panelId, ctx)
  return {
    ...sharedUpdateFields(existingRevision, ctx, {
      source: test.source || "blood_pdf",
      sourceName: test.provider || null,
      payload: markerPayload(marker),
    }),
    panel_id: insertLike.panel_id,
    marker_key: insertLike.marker_key,
    name: insertLike.name,
    value: insertLike.value,
    unit: insertLike.unit,
    reference_low: insertLike.reference_low,
    reference_high: insertLike.reference_high,
    reference_text: insertLike.reference_text,
    status: insertLike.status,
  }
}

export function bloodMarkerFromRow(row: BloodResultRow): BloodMarker {
  const localId =
    typeof row.payload.local_id === "string" ? row.payload.local_id : row.id
  return {
    id: localId,
    name: row.name,
    key: row.marker_key,
    value: row.value,
    unit: row.unit,
    referenceRange: {
      low: row.reference_low ?? undefined,
      high: row.reference_high ?? undefined,
      text: row.reference_text ?? "",
    },
    status: (row.status as BloodMarkerStatus) || "unknown",
    fingerprint: row.fingerprint,
  }
}

export function bloodTestFromRows(
  panel: BloodPanelRow,
  markers: BloodResultRow[]
): BloodTest {
  const localId =
    typeof panel.payload.local_id === "string"
      ? panel.payload.local_id
      : panel.id
  return {
    id: localId,
    provider: panel.provider,
    panelName: panel.panel_name,
    testDate: panel.test_date,
    exportedAt: panel.exported_at ?? undefined,
    patientName: panel.patient_name ?? undefined,
    sex: panel.sex ?? undefined,
    markers: markers.map(bloodMarkerFromRow),
    clinicalReview: panel.clinical_review ?? undefined,
    sourceFileName: panel.source_file_name,
    source: panel.source,
    fingerprint: panel.fingerprint,
  }
}
