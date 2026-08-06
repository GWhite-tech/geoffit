import type { BloodTest } from "@/lib/domain/blood"
import type { HevyWorkoutEntry } from "@/lib/health/workout/workout-store"
import type { ParsedImportData } from "@/lib/importers/Importer"

import type { DomainReplayKind } from "./meta"

export function extractBloodTests(payload: ParsedImportData | null): BloodTest[] {
  if (!payload?.metadata) return []
  const many = payload.metadata.domainBloodTests
  if (Array.isArray(many) && many.length > 0) {
    return many as BloodTest[]
  }
  const one = payload.metadata.domainBloodTest as BloodTest | undefined
  if (one && Array.isArray(one.markers)) return [one]
  return []
}

export function extractHevyWorkouts(
  payload: ParsedImportData | null
): HevyWorkoutEntry[] {
  if (!payload?.metadata) return []
  const workouts = payload.metadata.hevyWorkouts
  return Array.isArray(workouts) ? (workouts as HevyWorkoutEntry[]) : []
}

export function extractDomainReplayItems(
  kind: DomainReplayKind,
  payload: ParsedImportData | null
): unknown[] {
  return kind === "blood_lab_pdf"
    ? extractBloodTests(payload)
    : extractHevyWorkouts(payload)
}
