/**
 * HealthRecord ↔ health_records row mapping (PR2).
 */

import type {
  HealthRecord,
  QuantityHealthRecord,
  SleepAnalysisRecord,
  WorkoutHealthRecord,
} from "@/lib/domain/health"

import type { SharedFactColumns, WriteContext } from "../types"
import { sharedInsertFields, sharedUpdateFields } from "./shared"

export type HealthRecordRow = SharedFactColumns & {
  metric_type: string
  value: number | null
  unit: string | null
  start_at: string
  end_at: string | null
  duration_minutes: number | null
  sleep_value: string | null
  raw_type: string | null
  device_name: string | null
  source_bundle_identifier: string | null
}

function domainPayload(record: HealthRecord): Record<string, unknown> {
  const base: Record<string, unknown> = {
    local_id: record.id,
  }
  if (record.creationDate) base.creationDate = record.creationDate
  if (record.device) base.device = record.device
  if (record.type === "workout") {
    const w = record as WorkoutHealthRecord
    base.activityType = w.activityType
    base.durationSeconds = w.durationSeconds
    if (w.totalDistanceMeters != null) {
      base.totalDistanceMeters = w.totalDistanceMeters
    }
    if (w.totalEnergyBurnedKcal != null) {
      base.totalEnergyBurnedKcal = w.totalEnergyBurnedKcal
    }
  }
  return base
}

export function healthRecordToInsertRow(
  record: HealthRecord,
  ctx: WriteContext
): Omit<HealthRecordRow, "id" | "created_at" | "updated_at" | "deleted_at"> {
  const shared = sharedInsertFields(ctx, {
    fingerprint: record.fingerprint,
    source: record.source || "apple_health",
    sourceName: record.sourceName,
    payload: domainPayload(record),
  })

  if (record.type === "sleep_analysis") {
    const s = record as SleepAnalysisRecord
    return {
      ...shared,
      metric_type: s.type,
      value: null,
      unit: null,
      start_at: s.startDate,
      end_at: s.endDate,
      duration_minutes: s.durationMinutes,
      sleep_value: s.sleepValue,
      raw_type: s.rawType,
      device_name: s.deviceName ?? null,
      source_bundle_identifier: s.sourceBundleIdentifier ?? null,
    }
  }

  if (record.type === "workout") {
    const w = record as WorkoutHealthRecord
    return {
      ...shared,
      metric_type: w.type,
      value: null,
      unit: null,
      start_at: w.startDate,
      end_at: w.endDate,
      duration_minutes: null,
      sleep_value: null,
      raw_type: w.activityType,
      device_name: w.deviceName ?? null,
      source_bundle_identifier: w.sourceBundleIdentifier ?? null,
    }
  }

  const q = record as QuantityHealthRecord
  return {
    ...shared,
    metric_type: q.type,
    value: q.value,
    unit: q.unit,
    start_at: q.startDate,
    end_at: q.endDate,
    duration_minutes: null,
    sleep_value: null,
    raw_type: q.rawType,
    device_name: q.deviceName ?? null,
    source_bundle_identifier: q.sourceBundleIdentifier ?? null,
  }
}

export function healthRecordToUpdatePatch(
  record: HealthRecord,
  existingRevision: number,
  ctx: WriteContext
): Partial<HealthRecordRow> {
  const shared = sharedUpdateFields(existingRevision, ctx, {
    source: record.source || "apple_health",
    sourceName: record.sourceName,
    payload: domainPayload(record),
  })
  const insertLike = healthRecordToInsertRow(record, ctx)
  return {
    ...shared,
    metric_type: insertLike.metric_type,
    value: insertLike.value,
    unit: insertLike.unit,
    start_at: insertLike.start_at,
    end_at: insertLike.end_at,
    duration_minutes: insertLike.duration_minutes,
    sleep_value: insertLike.sleep_value,
    raw_type: insertLike.raw_type,
    device_name: insertLike.device_name,
    source_bundle_identifier: insertLike.source_bundle_identifier,
  }
}

export function healthRecordFromRow(row: HealthRecordRow): HealthRecord {
  const localId =
    typeof row.payload.local_id === "string" ? row.payload.local_id : row.id
  const base = {
    id: localId,
    source: row.source,
    sourceName: row.source_name ?? undefined,
    sourceBundleIdentifier: row.source_bundle_identifier ?? undefined,
    deviceName: row.device_name ?? undefined,
    device:
      typeof row.payload.device === "string" ? row.payload.device : undefined,
    creationDate:
      typeof row.payload.creationDate === "string"
        ? row.payload.creationDate
        : undefined,
    startDate: row.start_at,
    endDate: row.end_at ?? row.start_at,
    fingerprint: row.fingerprint,
  }

  if (row.metric_type === "sleep_analysis") {
    return {
      ...base,
      type: "sleep_analysis",
      sleepValue: row.sleep_value ?? "",
      durationMinutes: row.duration_minutes ?? 0,
      rawType: row.raw_type ?? "HKCategoryTypeIdentifierSleepAnalysis",
    }
  }

  if (row.metric_type === "workout") {
    return {
      ...base,
      type: "workout",
      activityType:
        (typeof row.payload.activityType === "string"
          ? row.payload.activityType
          : null) ??
        row.raw_type ??
        "HKWorkoutActivityTypeOther",
      durationSeconds:
        typeof row.payload.durationSeconds === "number"
          ? row.payload.durationSeconds
          : 0,
      totalDistanceMeters:
        typeof row.payload.totalDistanceMeters === "number"
          ? row.payload.totalDistanceMeters
          : undefined,
      totalEnergyBurnedKcal:
        typeof row.payload.totalEnergyBurnedKcal === "number"
          ? row.payload.totalEnergyBurnedKcal
          : undefined,
    }
  }

  return {
    ...base,
    type: row.metric_type as QuantityHealthRecord["type"],
    value: row.value ?? 0,
    unit: row.unit ?? "",
    rawType: row.raw_type ?? row.metric_type,
  }
}
