/**
 * Client: download Blood/Hevy domain-replay artefacts → local stores.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import type { BloodTest } from "@/lib/domain/blood"
import { getBloodStore } from "@/lib/health"
import { getWorkoutStore } from "@/lib/health/workout"
import type { HevyWorkoutEntry } from "@/lib/health/workout/workout-store"

import {
  isDomainReplayPersistMeta,
  type DomainReplayPayloadV1,
  type DomainReplayPersistMeta,
} from "./meta"

function isBloodTest(value: unknown): value is BloodTest {
  if (!value || typeof value !== "object") return false
  const t = value as Record<string, unknown>
  return (
    typeof t.id === "string" &&
    typeof t.testDate === "string" &&
    typeof t.fingerprint === "string" &&
    Array.isArray(t.markers)
  )
}

function isHevyWorkout(value: unknown): value is HevyWorkoutEntry {
  if (!value || typeof value !== "object") return false
  const w = value as Record<string, unknown>
  return (
    typeof w.id === "string" &&
    typeof w.name === "string" &&
    typeof w.startDate === "string" &&
    Array.isArray(w.exercises)
  )
}

async function downloadReplayPayload(
  supabase: SupabaseClient,
  persist: DomainReplayPersistMeta
): Promise<DomainReplayPayloadV1> {
  if (!isDomainReplayPersistMeta(persist) || !persist.complete) {
    throw new Error("Invalid or incomplete domain-replay persist meta")
  }

  const { data, error } = await supabase.storage
    .from(persist.bucket)
    .download(persist.path)

  if (error || !data) {
    throw new Error(
      error?.message ?? `Missing domain-replay object: ${persist.path}`
    )
  }

  const text = await data.text()
  const parsed = JSON.parse(text) as DomainReplayPayloadV1
  if (
    !parsed ||
    parsed.version !== 1 ||
    parsed.kind !== persist.kind ||
    !Array.isArray(parsed.items)
  ) {
    throw new Error(`Invalid domain-replay payload at ${persist.path}`)
  }
  return parsed
}

/** Replay BloodTest[] into BloodStore (no parser). */
export async function ingestBloodDomainReplay(input: {
  supabase: SupabaseClient
  persist: DomainReplayPersistMeta
}): Promise<{ ingested: number }> {
  if (input.persist.kind !== "blood_lab_pdf") {
    throw new Error("Expected blood_lab_pdf domain-replay artefact")
  }
  const payload = await downloadReplayPayload(input.supabase, input.persist)
  const tests = payload.items.filter(isBloodTest)
  if (tests.length === 0) {
    throw new Error("Blood domain-replay artefact contained no BloodTest items")
  }
  getBloodStore().ingest(tests)
  return { ingested: tests.length }
}

/** Replay HevyWorkoutEntry[] into WorkoutStore (no parser). */
export async function ingestHevyDomainReplay(input: {
  supabase: SupabaseClient
  persist: DomainReplayPersistMeta
}): Promise<{ ingested: number }> {
  if (input.persist.kind !== "hevy_csv") {
    throw new Error("Expected hevy_csv domain-replay artefact")
  }
  const payload = await downloadReplayPayload(input.supabase, input.persist)
  const workouts = payload.items.filter(isHevyWorkout)
  if (workouts.length === 0) {
    throw new Error(
      "Hevy domain-replay artefact contained no HevyWorkoutEntry items"
    )
  }
  getWorkoutStore().ingest(workouts)
  return { ingested: workouts.length }
}
