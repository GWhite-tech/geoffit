/**
 * Nutrition day helpers — day key / clinical equality / multi-record rollup.
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { HealthRecord, QuantityHealthRecord } from "@/lib/domain/health"

import {
  buildNutritionDaysFromHealthRecords,
  dietaryDayKeysFromHealthRecords,
  nutritionDayKeyFromStartDate,
  nutritionDaysClinicallyEqual,
  nutritionDayUtcBounds,
} from "./from-health-store"

function dietary(
  partial: Partial<QuantityHealthRecord> & {
    type: QuantityHealthRecord["type"]
    value: number
    fingerprint: string
    startDate: string
  }
): QuantityHealthRecord {
  return {
    id: partial.id ?? partial.fingerprint,
    type: partial.type,
    source: partial.source ?? "apple_health",
    sourceName: partial.sourceName ?? "Apple Health",
    startDate: partial.startDate,
    endDate: partial.endDate ?? partial.startDate,
    fingerprint: partial.fingerprint,
    value: partial.value,
    unit:
      partial.unit ?? (partial.type === "dietary_energy" ? "kcal" : "g"),
    rawType: partial.rawType ?? `HKQuantityTypeIdentifier${partial.type}`,
  }
}

describe("nutrition day key / timezone semantics", () => {
  it("uses startDate.slice(0, 10) — UTC ISO from Apple Health mapper", () => {
    assert.equal(
      nutritionDayKeyFromStartDate("2026-08-01T23:30:00.000Z"),
      "2026-08-01"
    )
    assert.equal(
      nutritionDayKeyFromStartDate("2026-08-01T00:00:00.000Z"),
      "2026-08-01"
    )
  })

  it("UTC bounds match that day key (not a local-timezone reinterpretation)", () => {
    assert.deepEqual(nutritionDayUtcBounds("2026-08-01"), {
      startAt: "2026-08-01T00:00:00.000Z",
      endAt: "2026-08-01T23:59:59.999Z",
    })
  })
})

describe("dietaryDayKeysFromHealthRecords", () => {
  it("returns empty for empty / non-dietary batches (G)", () => {
    assert.deepEqual(dietaryDayKeysFromHealthRecords([]), [])
    assert.deepEqual(
      dietaryDayKeysFromHealthRecords([
        {
          id: "w1",
          type: "body_mass",
          source: "apple_health",
          startDate: "2026-08-01T06:00:00.000Z",
          endDate: "2026-08-01T06:00:00.000Z",
          fingerprint: "bm|1",
          value: 80,
          unit: "kg",
          rawType: "HKQuantityTypeIdentifierBodyMass",
        },
      ]),
      []
    )
  })

  it("collects unique dates from dietary samples (H)", () => {
    const keys = dietaryDayKeysFromHealthRecords([
      dietary({
        type: "dietary_energy",
        value: 1000,
        fingerprint: "e1",
        startDate: "2026-08-01T08:00:00.000Z",
      }),
      dietary({
        type: "dietary_protein",
        value: 40,
        fingerprint: "p1",
        startDate: "2026-08-01T12:00:00.000Z",
      }),
      dietary({
        type: "dietary_energy",
        value: 500,
        fingerprint: "e2",
        startDate: "2026-08-02T09:00:00.000Z",
      }),
    ])
    assert.deepEqual(keys, ["2026-08-01", "2026-08-02"])
  })
})

describe("buildNutritionDaysFromHealthRecords", () => {
  it("sums multiple records on the same date (H)", () => {
    const days = buildNutritionDaysFromHealthRecords([
      dietary({
        type: "dietary_energy",
        value: 2000,
        fingerprint: "e1",
        startDate: "2026-08-01T08:00:00.000Z",
      }),
      dietary({
        type: "dietary_energy",
        value: 500,
        fingerprint: "e2",
        startDate: "2026-08-01T18:00:00.000Z",
      }),
      dietary({
        type: "dietary_protein",
        value: 80,
        fingerprint: "p1",
        startDate: "2026-08-01T08:00:00.000Z",
      }),
      dietary({
        type: "dietary_protein",
        value: 20,
        fingerprint: "p2",
        startDate: "2026-08-01T18:00:00.000Z",
      }),
    ])
    assert.equal(days.length, 1)
    assert.equal(days[0]!.date, "2026-08-01")
    assert.equal(days[0]!.calories, 2500)
    assert.equal(days[0]!.protein, 100)
    assert.equal(days[0]!.source, "apple_health")
  })

  it("returns empty for empty dietary input (G)", () => {
    assert.deepEqual(buildNutritionDaysFromHealthRecords([]), [])
  })
})

describe("nutritionDaysClinicallyEqual", () => {
  it("treats identical clinical values as equal (A)", () => {
    const day = {
      date: "2026-08-01",
      calories: 2500,
      protein: 100,
      carbohydrates: 200,
      fat: 70,
      fibre: 30,
      water: 2,
      sugar: 10,
      sodium: 2000,
      alcohol: 0,
      caffeine: 100,
    }
    assert.equal(nutritionDaysClinicallyEqual(day, { ...day }), true)
  })

  it("detects changed clinical values (B)", () => {
    const a = {
      date: "2026-08-01",
      calories: 2000,
      protein: 80,
      carbohydrates: 0,
      fat: 0,
      fibre: 0,
      water: 0,
    }
    const b = { ...a, calories: 2500, protein: 100 }
    assert.equal(nutritionDaysClinicallyEqual(a, b), false)
  })
})
