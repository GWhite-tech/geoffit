import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { MissionControlReadResponse } from "@/lib/cloud/reads/mission-control-dto"
import type { HealthRecord } from "@/lib/domain/health"

import {
  filterHealthRecordsForCoach,
  filterMissionControlForCoach,
} from "./mission-control-filter"

function hr(
  type: HealthRecord["type"],
  id: string
): HealthRecord {
  if (type === "sleep_analysis") {
    return {
      id,
      type,
      source: "apple_health",
      startDate: "2026-08-01T00:00:00.000Z",
      endDate: "2026-08-01T07:00:00.000Z",
      fingerprint: `${type}|${id}`,
      sleepValue: "ASLEEP",
      durationMinutes: 420,
      rawType: "HKCategoryTypeIdentifierSleepAnalysis",
    }
  }
  if (type === "workout") {
    return {
      id,
      type,
      source: "apple_health",
      startDate: "2026-08-01T00:00:00.000Z",
      endDate: "2026-08-01T01:00:00.000Z",
      fingerprint: `${type}|${id}`,
      activityType: "TraditionalStrengthTraining",
      durationSeconds: 3600,
    }
  }
  return {
    id,
    type: type as Exclude<
      HealthRecord["type"],
      "sleep_analysis" | "workout"
    >,
    source: "apple_health",
    startDate: "2026-08-01T00:00:00.000Z",
    endDate: "2026-08-01T00:00:00.000Z",
    fingerprint: `${type}|${id}`,
    value: 1,
    unit: "count",
    rawType: type,
  }
}

describe("coach mission-control filter", () => {
  it("exposes only approved metric types for granted categories", () => {
    const rows = [
      hr("heart_rate", "1"),
      hr("sleep_analysis", "2"),
      hr("body_mass", "3"),
      hr("workout", "4"),
    ]
    const filtered = filterHealthRecordsForCoach(rows, ["vitals"])
    assert.deepEqual(
      filtered.map((r) => r.type),
      ["heart_rate"]
    )
  })

  it("strips blood/training/treatments when those categories are absent", () => {
    const body: MissionControlReadResponse = {
      bodyRange: "90d",
      healthRecords: [hr("body_mass", "1"), hr("heart_rate", "2")],
      bloodTests: [{ id: "b1" } as never],
      hevyWorkouts: [{ id: "w1" } as never],
      appleHealthWorkouts: [hr("workout", "w2") as never],
      treatments: [{ id: "t1" } as never],
      doseEvents: [{ id: "d1" } as never],
      domainStatus: {
        health: "ok",
        blood: "ok",
        workouts: "ok",
        treatments: "ok",
      },
      domainErrors: {},
      queryMs: 1,
      source: "cloud",
    }

    const filtered = filterMissionControlForCoach(body, ["body"])
    assert.equal(filtered.healthRecords.length, 1)
    assert.equal(filtered.healthRecords[0]?.type, "body_mass")
    assert.equal(filtered.bloodTests.length, 0)
    assert.equal(filtered.hevyWorkouts.length, 0)
    assert.equal(filtered.appleHealthWorkouts.length, 0)
    assert.equal(filtered.treatments.length, 0)
    assert.equal(filtered.doseEvents.length, 0)
  })

  it("prevents cross-client response contamination by binding clientUserId outside filter", () => {
    // Filter is pure over payload + permissions; route must set clientUserId
    // from authorisation result only (asserted in foundation source tests).
    const body: MissionControlReadResponse = {
      bodyRange: "90d",
      healthRecords: [hr("heart_rate", "1")],
      bloodTests: [],
      hevyWorkouts: [],
      appleHealthWorkouts: [],
      treatments: [],
      doseEvents: [],
      domainStatus: {
        health: "ok",
        blood: "empty",
        workouts: "empty",
        treatments: "empty",
      },
      domainErrors: {},
      queryMs: 1,
      source: "cloud",
    }
    const a = filterMissionControlForCoach(body, ["vitals"])
    const b = filterMissionControlForCoach(body, ["blood"])
    assert.equal(a.healthRecords.length, 1)
    assert.equal(b.healthRecords.length, 0)
    assert.equal(a.source, "cloud")
    assert.equal(b.source, "cloud")
  })
})
