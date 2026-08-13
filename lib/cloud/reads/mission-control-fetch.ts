/**
 * Server-side Mission Control parallel domain fetch (PR4 Stage 5).
 * Call only from authenticated Route Handlers with a user-scoped client.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import { createCloudRepositories } from "@/lib/cloud"
import type { HealthRecord } from "@/lib/domain/health"
import type { McTimeRange } from "@/lib/health/analytics/types"

import type { MissionControlReadResponse } from "./mission-control-dto"
import {
  clampMissionControlBodyLimit,
  clampMissionControlRecoveryLimit,
  missionControlBodyMetricTypes,
  missionControlRecoveryMetricTypes,
  missionControlStartAt,
} from "./mission-control-query"

type DomainResult<T> = {
  value: T
  status: "ok" | "empty" | "error"
  error?: string
}

async function settledDomain<T>(
  promise: Promise<T>,
  empty: T,
  isEmpty: (value: T) => boolean
): Promise<DomainResult<T>> {
  try {
    const value = await promise
    return { value, status: isEmpty(value) ? "empty" : "ok" }
  } catch (error) {
    return {
      value: empty,
      status: "error",
      error: error instanceof Error ? error.message : "Domain read failed",
    }
  }
}

function mergeHealthStatus(
  body: DomainResult<HealthRecord[]>,
  recovery: DomainResult<HealthRecord[]>
): DomainResult<HealthRecord[]> {
  const value = [...body.value, ...recovery.value]
  if (body.status === "error" && recovery.status === "error") {
    return {
      value,
      status: "error",
      error: [body.error, recovery.error].filter(Boolean).join("; "),
    }
  }
  if (value.length === 0) {
    if (body.status === "error" || recovery.status === "error") {
      return {
        value,
        status: "error",
        error: body.error ?? recovery.error,
      }
    }
    return { value, status: "empty" }
  }
  return { value, status: "ok" }
}

/**
 * Fetch Mission Control health in two bounded queries:
 * 1) sparse body composition (weight / fat / lean) — must not share a row
 *    budget with dense HRV/sleep or charts truncate to ~days of history
 * 2) recovery metrics with their own PostgREST-safe limit
 */
export async function fetchMissionControlRead(
  supabase: SupabaseClient,
  userId: string,
  bodyRange: McTimeRange
): Promise<MissionControlReadResponse> {
  const repos = createCloudRepositories(supabase)
  const startAt = missionControlStartAt(bodyRange)
  const bodyLimit = clampMissionControlBodyLimit()
  const recoveryLimit = clampMissionControlRecoveryLimit()
  const started = performance.now()

  const [bodyHealth, recoveryHealth, blood, workouts, treatments] =
    await Promise.all([
      settledDomain(
        repos.health.listByMetricTypes(userId, {
          metricTypes: missionControlBodyMetricTypes(),
          startAt,
          limit: bodyLimit,
        }),
        [] as HealthRecord[],
        (rows) => rows.length === 0
      ),
      settledDomain(
        repos.health.listByMetricTypes(userId, {
          metricTypes: missionControlRecoveryMetricTypes(),
          startAt,
          limit: recoveryLimit,
        }),
        [] as HealthRecord[],
        (rows) => rows.length === 0
      ),
      settledDomain(
        repos.blood.listPanels(userId, { limit: 100 }),
        [],
        (rows) => rows.length === 0
      ),
      settledDomain(
        repos.workouts.listByStartRange(userId, {
          startAt,
          limit: 100,
        }),
        { hevy: [], appleHealth: [] },
        (value) => value.hevy.length === 0 && value.appleHealth.length === 0
      ),
      settledDomain(
        repos.treatments.listGraph(userId, {
          treatmentLimit: 50,
          doseLimit: 40,
        }),
        { treatments: [], lots: [], doseEvents: [] },
        (value) =>
          value.treatments.length === 0 && value.doseEvents.length === 0
      ),
    ])

  const health = mergeHealthStatus(bodyHealth, recoveryHealth)

  const queryMs = Math.round((performance.now() - started) * 100) / 100
  const domainErrors: MissionControlReadResponse["domainErrors"] = {}
  if (health.error) domainErrors.health = health.error
  if (blood.error) domainErrors.blood = blood.error
  if (workouts.error) domainErrors.workouts = workouts.error
  if (treatments.error) domainErrors.treatments = treatments.error

  return {
    bodyRange,
    healthRecords: health.value,
    bloodTests: blood.value,
    hevyWorkouts: workouts.value.hevy,
    appleHealthWorkouts: workouts.value.appleHealth,
    treatments: treatments.value.treatments,
    doseEvents: treatments.value.doseEvents,
    domainStatus: {
      health: health.status,
      blood: blood.status,
      workouts: workouts.status,
      treatments: treatments.status,
    },
    domainErrors,
    queryMs,
    source: "cloud",
  }
}
