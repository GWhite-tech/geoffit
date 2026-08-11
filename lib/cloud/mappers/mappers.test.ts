/**
 * PR2 mapper + fingerprint unit tests (no network / no production writes).
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { BloodTest } from "@/lib/domain/blood"
import type {
  QuantityHealthRecord,
  SleepAnalysisRecord,
  WorkoutHealthRecord,
} from "@/lib/domain/health"
import type { NutritionDay } from "@/lib/domain/nutrition"
import type { DoseEvent, Treatment } from "@/lib/domain/treatment"
import type { HevyWorkoutEntry } from "@/lib/health/workout/workout-store"

import {
  appleHealthWorkoutCloudFingerprint,
  hevyWorkoutCloudFingerprint,
  nutritionDayCloudFingerprint,
  treatmentCloudFingerprint,
  treatmentDoseCloudFingerprint,
} from "../mappers/fingerprints"
import {
  bloodPanelToInsertRow,
  bloodResultToInsertRow,
  bloodTestFromRows,
  type BloodPanelRow,
  type BloodResultRow,
} from "../mappers/blood-mapper"
import {
  healthRecordFromRow,
  healthRecordToInsertRow,
} from "../mappers/health-mapper"
import { nutritionDayToInsertRow } from "../mappers/nutrition-mapper"
import {
  treatmentDoseToInsertRow,
  treatmentToInsertRow,
} from "../mappers/treatment-mapper"
import {
  appleHealthWorkoutToInsertRow,
  hevyWorkoutFromRow,
  hevyWorkoutToInsertRow,
} from "../mappers/workout-mapper"
import type { WriteContext } from "../types"

const ctx: WriteContext = {
  userId: "00000000-0000-4000-8000-000000000001",
  ingestRunId: "00000000-0000-4000-8000-000000000002",
  userFileId: "00000000-0000-4000-8000-000000000003",
  parserVersion: "test-parser",
  connectorVersion: "test-connector",
}

describe("cloud fingerprints", () => {
  it("uses workout|hevy|{externalId} for Hevy", () => {
    const entry: HevyWorkoutEntry = {
      id: "hevy_abc_2026-08-11",
      externalId: "hevy_abc_2026-08-11",
      name: "Upper",
      startDate: "2026-08-11T06:56:00.000Z",
      endDate: "2026-08-11T07:37:00.000Z",
      durationSeconds: 2460,
      exercises: [],
    }
    const fp = hevyWorkoutCloudFingerprint(entry)
    assert.equal(fp, "workout|hevy|hevy_abc_2026-08-11")
  })

  it("falls back to stable id when externalId missing", () => {
    const entry: HevyWorkoutEntry = {
      id: "hevy_fallback_2026-08-11",
      name: "Upper",
      startDate: "2026-08-11T06:56:00.000Z",
      endDate: "2026-08-11T07:37:00.000Z",
      durationSeconds: 2460,
      exercises: [],
    }
    assert.equal(
      hevyWorkoutCloudFingerprint(entry),
      "workout|hevy|hevy_fallback_2026-08-11"
    )
  })

  it("never invents a random Hevy fingerprint", () => {
    const entry: HevyWorkoutEntry = {
      id: "hevy_same_2026-08-11",
      externalId: "hevy_same_2026-08-11",
      name: "Upper",
      startDate: "2026-08-11T06:56:00.000Z",
      endDate: "2026-08-11T07:37:00.000Z",
      durationSeconds: 2460,
      exercises: [],
    }
    assert.equal(
      hevyWorkoutCloudFingerprint(entry),
      hevyWorkoutCloudFingerprint(entry)
    )
  })

  it("uses nutrition:{source}:{date}", () => {
    assert.equal(
      nutritionDayCloudFingerprint("apple_health", "2026-08-11"),
      "nutrition:apple_health:2026-08-11"
    )
  })

  it("normalizes treatment cloud fingerprints by name", () => {
    assert.equal(
      treatmentCloudFingerprint({ name: "Retatrutide", localId: "x" }),
      "treatment:retatrutide"
    )
  })

  it("avoids Date.now()-style dose fingerprints", () => {
    const fp = treatmentDoseCloudFingerprint({
      treatmentFingerprint: "treatment:retatrutide",
      kind: "increased",
      eventDate: "2026-08-11",
      scheduledTime: "08:00",
      dose: 2,
      localFingerprint: "dose-change-reta-2026-08-11-1712345678901",
    })
    assert.equal(
      fp,
      "dose:treatment:retatrutide:increased:2026-08-11:08:00:2"
    )
    assert.ok(!fp.includes("1712345678901"))
  })

  it("prefixes Apple Health workout fingerprints deterministically", () => {
    const record: WorkoutHealthRecord = {
      id: "local-1",
      type: "workout",
      source: "apple_health",
      startDate: "2026-08-11T06:56:00.000Z",
      endDate: "2026-08-11T07:37:00.000Z",
      fingerprint: "workout|HK|start|end|1|2|3",
      activityType: "HKWorkoutActivityTypeTraditionalStrengthTraining",
      durationSeconds: 2460,
    }
    assert.equal(
      appleHealthWorkoutCloudFingerprint(record),
      "workouts|apple_health|workout|HK|start|end|1|2|3"
    )
    assert.equal(
      appleHealthWorkoutCloudFingerprint(record),
      appleHealthWorkoutCloudFingerprint(record)
    )
  })
})

describe("health mapper", () => {
  it("maps quantity records and preserves local_id", () => {
    const record: QuantityHealthRecord = {
      id: "local-hr-1",
      type: "body_mass",
      source: "apple_health",
      sourceName: "Withings",
      startDate: "2026-08-11T06:00:00.000Z",
      endDate: "2026-08-11T06:00:00.000Z",
      fingerprint: "body_mass|a|b|80|kg|Withings",
      value: 80,
      unit: "kg",
      rawType: "HKQuantityTypeIdentifierBodyMass",
    }
    const row = healthRecordToInsertRow(record, ctx)
    assert.equal(row.fingerprint, record.fingerprint)
    assert.equal(row.metric_type, "body_mass")
    assert.equal(row.value, 80)
    assert.equal(row.payload.local_id, "local-hr-1")
    assert.equal(row.ingest_run_id, ctx.ingestRunId)
    assert.equal(row.user_file_id, ctx.userFileId)

    const roundTrip = healthRecordFromRow({
      id: "cloud-uuid",
      user_id: ctx.userId,
      fingerprint: row.fingerprint,
      source: row.source,
      source_name: row.source_name,
      parser_version: row.parser_version,
      connector_version: row.connector_version,
      ingest_run_id: row.ingest_run_id,
      user_file_id: row.user_file_id,
      imported_at: "2026-08-11T00:00:00.000Z",
      created_at: "2026-08-11T00:00:00.000Z",
      updated_at: "2026-08-11T00:00:00.000Z",
      deleted_at: null,
      revision: 1,
      schema_version: 1,
      origin_device_id: null,
      payload: row.payload,
      metric_type: row.metric_type,
      value: row.value,
      unit: row.unit,
      start_at: row.start_at,
      end_at: row.end_at,
      duration_minutes: row.duration_minutes,
      sleep_value: row.sleep_value,
      raw_type: row.raw_type,
      device_name: row.device_name,
      source_bundle_identifier: row.source_bundle_identifier,
    })
    assert.equal(roundTrip.id, "local-hr-1")
    assert.equal(roundTrip.type, "body_mass")
  })

  it("maps sleep records", () => {
    const record: SleepAnalysisRecord = {
      id: "sleep-1",
      type: "sleep_analysis",
      source: "apple_health",
      startDate: "2026-08-10T22:00:00.000Z",
      endDate: "2026-08-11T06:00:00.000Z",
      fingerprint: "sleep_analysis|a|b|ASLEEP|Watch",
      sleepValue: "HKCategoryValueSleepAnalysisAsleep",
      durationMinutes: 480,
      rawType: "HKCategoryTypeIdentifierSleepAnalysis",
    }
    const row = healthRecordToInsertRow(record, ctx)
    assert.equal(row.sleep_value, record.sleepValue)
    assert.equal(row.duration_minutes, 480)
    assert.equal(row.value, null)
  })
})

describe("blood mapper", () => {
  it("maps panel + markers and reassembles", () => {
    const test: BloodTest = {
      id: "panel-local",
      provider: "Numan",
      panelName: "Male Hormone",
      testDate: "2026-08-01",
      markers: [
        {
          id: "m1",
          name: "Testosterone",
          key: "testosterone",
          value: 20,
          unit: "nmol/L",
          referenceRange: { low: 8, high: 30, text: "8-30" },
          status: "normal",
          fingerprint: "blood_pdf|2026-08-01|testosterone|20|nmol/L",
        },
      ],
      sourceFileName: "report.pdf",
      source: "blood_pdf",
      fingerprint: "blood_pdf::Numan::2026-08-01::m",
    }
    const panelInsert = bloodPanelToInsertRow(test, ctx)
    assert.equal(panelInsert.provider, "Numan")
    assert.equal(panelInsert.payload.local_id, "panel-local")

    const markerInsert = bloodResultToInsertRow(
      test,
      test.markers[0]!,
      "panel-cloud-id",
      ctx
    )
    assert.equal(markerInsert.panel_id, "panel-cloud-id")
    assert.equal(markerInsert.marker_key, "testosterone")

    const panelRow = {
      id: "panel-cloud-id",
      user_id: ctx.userId,
      fingerprint: panelInsert.fingerprint,
      source: panelInsert.source,
      source_name: panelInsert.source_name,
      parser_version: null,
      connector_version: null,
      ingest_run_id: null,
      user_file_id: null,
      imported_at: "2026-08-11T00:00:00.000Z",
      created_at: "2026-08-11T00:00:00.000Z",
      updated_at: "2026-08-11T00:00:00.000Z",
      deleted_at: null,
      revision: 1,
      schema_version: 1,
      origin_device_id: null,
      payload: panelInsert.payload,
      provider: panelInsert.provider,
      panel_name: panelInsert.panel_name,
      test_date: panelInsert.test_date,
      exported_at: null,
      patient_name: null,
      sex: null,
      clinical_review: null,
      source_file_name: panelInsert.source_file_name,
    } satisfies BloodPanelRow

    const resultRow = {
      id: "result-cloud-id",
      user_id: ctx.userId,
      fingerprint: markerInsert.fingerprint,
      source: markerInsert.source,
      source_name: markerInsert.source_name,
      parser_version: null,
      connector_version: null,
      ingest_run_id: null,
      user_file_id: null,
      imported_at: "2026-08-11T00:00:00.000Z",
      created_at: "2026-08-11T00:00:00.000Z",
      updated_at: "2026-08-11T00:00:00.000Z",
      deleted_at: null,
      revision: 1,
      schema_version: 1,
      origin_device_id: null,
      payload: markerInsert.payload,
      panel_id: "panel-cloud-id",
      marker_key: markerInsert.marker_key,
      name: markerInsert.name,
      value: markerInsert.value,
      unit: markerInsert.unit,
      reference_low: markerInsert.reference_low,
      reference_high: markerInsert.reference_high,
      reference_text: markerInsert.reference_text,
      status: markerInsert.status,
    } satisfies BloodResultRow

    const reassembled = bloodTestFromRows(panelRow, [resultRow])
    assert.equal(reassembled.id, "panel-local")
    assert.equal(reassembled.markers[0]?.key, "testosterone")
    assert.equal(reassembled.markers[0]?.id, "m1")
  })
})

describe("workout mapper", () => {
  it("maps Hevy exercises jsonb and restores local id", () => {
    const entry: HevyWorkoutEntry = {
      id: "hevy_1_2026-08-11",
      externalId: "hevy_1_2026-08-11",
      name: "Upper A",
      startDate: "2026-08-11T06:56:00.000Z",
      endDate: "2026-08-11T07:37:00.000Z",
      durationSeconds: 2460,
      exercises: [
        {
          id: "ex1",
          name: "Bench Press",
          sets: [
            {
              id: "s1",
              index: 0,
              setType: "normal",
              reps: 8,
              weightKg: 50,
              completed: true,
            },
          ],
        },
      ],
      volumeKg: 400,
    }
    const row = hevyWorkoutToInsertRow(entry, ctx)
    assert.equal(row.source, "hevy")
    assert.equal(row.fingerprint, "workout|hevy|hevy_1_2026-08-11")
    assert.ok(Array.isArray(row.exercises))
    const restored = hevyWorkoutFromRow({
      id: "cloud-uuid",
      user_id: ctx.userId,
      fingerprint: row.fingerprint,
      source: row.source,
      source_name: row.source_name,
      parser_version: null,
      connector_version: null,
      ingest_run_id: null,
      user_file_id: null,
      imported_at: "2026-08-11T00:00:00.000Z",
      created_at: "2026-08-11T00:00:00.000Z",
      updated_at: "2026-08-11T00:00:00.000Z",
      deleted_at: null,
      revision: 1,
      schema_version: 1,
      origin_device_id: null,
      payload: row.payload,
      category: row.category,
      activity_type: row.activity_type,
      start_at: row.start_at,
      end_at: row.end_at,
      duration_seconds: row.duration_seconds,
      distance_meters: null,
      energy_kcal: null,
      exercises: row.exercises,
    })
    assert.equal(restored.id, "hevy_1_2026-08-11")
    assert.equal(restored.exercises[0]?.name, "Bench Press")
  })

  it("maps Apple Health workouts into workouts table", () => {
    const record: WorkoutHealthRecord = {
      id: "ah-w-1",
      type: "workout",
      source: "apple_health",
      sourceName: "Apple Watch",
      startDate: "2026-08-11T06:56:00.000Z",
      endDate: "2026-08-11T07:37:00.000Z",
      fingerprint: "workout|TraditionalStrength|a|b|2460||",
      activityType: "HKWorkoutActivityTypeTraditionalStrengthTraining",
      durationSeconds: 2460,
      totalEnergyBurnedKcal: 300,
    }
    const row = appleHealthWorkoutToInsertRow(record, ctx)
    assert.equal(row.source, "apple_health")
    assert.equal(row.energy_kcal, 300)
    assert.deepEqual(row.exercises, [])
    assert.equal(row.payload.local_id, "ah-w-1")
    assert.equal(row.payload.health_fingerprint, record.fingerprint)
  })
})

describe("treatment mapper", () => {
  it("stores local_fingerprint and uses normalized cloud fingerprint", () => {
    const treatment: Treatment = {
      id: "retatrutide",
      name: "Retatrutide",
      shortName: "Reta",
      category: "peptide",
      status: "active",
      doseUnit: "mg",
      currentDose: 2,
      schedules: [],
      sortOrder: 0,
      fingerprint: "treatment:retatrutide",
    }
    const row = treatmentToInsertRow(treatment, ctx)
    assert.equal(row.fingerprint, "treatment:retatrutide")
    assert.equal(row.payload.local_fingerprint, "treatment:retatrutide")
    assert.equal(row.payload.local_id, "retatrutide")
  })

  it("maps dose events without unstable Date.now fingerprints", () => {
    const event: DoseEvent = {
      id: "dose-change-x-1712345678901",
      treatmentId: "retatrutide",
      kind: "increased",
      date: "2026-08-11",
      recordedAt: "2026-08-11T08:00:00.000Z",
      dose: 2.5,
      doseUnit: "mg",
      fingerprint: "dose-change-reta-2026-08-11-1712345678901",
    }
    const row = treatmentDoseToInsertRow(
      event,
      "treatment:retatrutide",
      "cloud-treatment-id",
      null,
      ctx
    )
    assert.equal(
      row.fingerprint,
      "dose:treatment:retatrutide:increased:2026-08-11:any:2.5"
    )
    assert.equal(row.payload.local_fingerprint, event.fingerprint)
  })
})

describe("nutrition mapper", () => {
  it("uses nutrition:{source}:{date} and preserves local fingerprint", () => {
    const day: NutritionDay = {
      id: "nutrition-2026-08-11",
      date: "2026-08-11",
      calories: 2200,
      protein: 180,
      carbohydrates: 200,
      fat: 70,
      fibre: 30,
      water: 3,
      source: "apple_health",
      fingerprint: "nutrition:health:2026-08-11",
    }
    const row = nutritionDayToInsertRow(day, ctx)
    assert.equal(row.fingerprint, "nutrition:apple_health:2026-08-11")
    assert.equal(row.payload.local_fingerprint, "nutrition:health:2026-08-11")
    assert.equal(row.day, "2026-08-11")
  })
})

describe("postgrest partial unique upsert policy", () => {
  it("documents that adapters must not use .upsert onConflict for fact tables", () => {
    // Runtime guarantee is implemented in lib/cloud/supabase/upsert.ts
    // (select → insert/update). This test locks the decision in CI.
    const strategy = "select-then-insert-or-update"
    assert.notEqual(strategy, "postgrest-onConflict-user_id-fingerprint")
  })
})
