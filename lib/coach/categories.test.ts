import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { HealthMetricType } from "@/lib/domain/health"
import { HEALTH_METRIC_LABELS } from "@/lib/domain/health"

import {
  COACH_PERMISSION_CATEGORIES,
  HEALTH_METRIC_COACH_CATEGORY,
  coachCategoryForMetric,
  isCoachPermissionCategory,
  metricTypesForCoachCategory,
  normalizeCoachPermissions,
  permissionsInclude,
} from "./categories"

describe("coach permission categories", () => {
  it("uses the constrained Phase 1 vocabulary only", () => {
    assert.deepEqual([...COACH_PERMISSION_CATEGORIES], [
      "vitals",
      "sleep",
      "body",
      "nutrition",
      "training",
      "blood",
      "treatments",
    ])
  })

  it("maps every HealthMetricType to exactly one coach category", () => {
    const metrics = Object.keys(HEALTH_METRIC_LABELS) as HealthMetricType[]
    for (const metric of metrics) {
      const category = coachCategoryForMetric(metric)
      assert.ok(
        category != null && isCoachPermissionCategory(category),
        `missing mapping for ${metric}`
      )
      // Canonical map entries must agree with coachCategoryForMetric.
      if (Object.prototype.hasOwnProperty.call(HEALTH_METRIC_COACH_CATEGORY, metric)) {
        assert.equal(
          category,
          HEALTH_METRIC_COACH_CATEGORY[
            metric as keyof typeof HEALTH_METRIC_COACH_CATEGORY
          ]
        )
      }
    }
  })

  it("does not invent unknown metric types", () => {
    assert.equal(coachCategoryForMetric("not_a_real_metric"), null)
    assert.equal(coachCategoryForMetric(""), null)
  })

  it("keeps vitals / sleep / body / training metric sets disjoint where expected", () => {
    const vitals = new Set(metricTypesForCoachCategory("vitals"))
    const sleep = new Set(metricTypesForCoachCategory("sleep"))
    const body = new Set(metricTypesForCoachCategory("body"))
    const training = new Set(metricTypesForCoachCategory("training"))

    assert.ok(vitals.has("heart_rate"))
    assert.ok(vitals.has("blood_pressure_systolic"))
    assert.ok(vitals.has("blood_pressure_diastolic"))
    assert.ok(vitals.has("step_count"))
    assert.ok(vitals.has("vo2_max"))
    assert.ok(sleep.has("sleep_analysis"))
    assert.ok(body.has("body_mass"))
    assert.ok(training.has("workout"))
    assert.equal(vitals.has("sleep_analysis"), false)
    assert.equal(sleep.has("heart_rate"), false)
    assert.equal(body.has("heart_rate"), false)
    assert.equal(training.has("body_mass"), false)
    assert.equal(coachCategoryForMetric("blood_pressure_systolic"), "vitals")
    assert.equal(coachCategoryForMetric("blood_pressure_diastolic"), "vitals")
  })

  it("rejects free-form permissions", () => {
    assert.equal(normalizeCoachPermissions(["hr_metric_level"]), null)
    assert.equal(normalizeCoachPermissions([]), null)
    assert.equal(normalizeCoachPermissions(["vitals", "blood"])?.length, 2)
  })

  it("training permission does not imply blood and vice versa", () => {
    assert.equal(permissionsInclude(["training"], "blood"), false)
    assert.equal(permissionsInclude(["blood"], "training"), false)
    assert.equal(permissionsInclude(["training", "blood"], "blood"), true)
  })
})
