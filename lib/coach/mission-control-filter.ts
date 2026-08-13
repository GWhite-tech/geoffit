/**
 * Filter Mission Control cloud read payload to coach-granted categories.
 * RLS is still authoritative; this avoids leaking empty-domain metadata
 * for ungated categories and keeps the proof endpoint category-aware.
 */

import type { MissionControlReadResponse } from "@/lib/cloud/reads/mission-control-dto"
import type { HealthRecord } from "@/lib/domain/health"

import {
  type CoachPermissionCategory,
  coachCategoryForMetric,
  permissionsInclude,
} from "./categories"

export function filterHealthRecordsForCoach(
  records: readonly HealthRecord[],
  permissions: readonly CoachPermissionCategory[]
): HealthRecord[] {
  return records.filter((row) => {
    const category = coachCategoryForMetric(row.type)
    if (!category) return false
    return permissionsInclude(permissions, category)
  })
}

export function filterMissionControlForCoach(
  body: MissionControlReadResponse,
  permissions: readonly CoachPermissionCategory[]
): MissionControlReadResponse {
  const healthRecords = filterHealthRecordsForCoach(
    body.healthRecords,
    permissions
  )
  const allowBlood = permissionsInclude(permissions, "blood")
  const allowTraining = permissionsInclude(permissions, "training")
  const allowTreatments = permissionsInclude(permissions, "treatments")

  return {
    ...body,
    healthRecords,
    bloodTests: allowBlood ? body.bloodTests : [],
    hevyWorkouts: allowTraining ? body.hevyWorkouts : [],
    appleHealthWorkouts: allowTraining ? body.appleHealthWorkouts : [],
    treatments: allowTreatments ? body.treatments : [],
    doseEvents: allowTreatments ? body.doseEvents : [],
    domainStatus: {
      health: healthRecords.length > 0 ? "ok" : "empty",
      blood: allowBlood ? body.domainStatus.blood : "empty",
      workouts: allowTraining ? body.domainStatus.workouts : "empty",
      treatments: allowTreatments ? body.domainStatus.treatments : "empty",
    },
    domainErrors: {
      ...(allowBlood && body.domainErrors.blood
        ? { blood: body.domainErrors.blood }
        : {}),
      ...(allowTraining && body.domainErrors.workouts
        ? { workouts: body.domainErrors.workouts }
        : {}),
      ...(allowTreatments && body.domainErrors.treatments
        ? { treatments: body.domainErrors.treatments }
        : {}),
      ...(body.domainErrors.health && healthRecords.length === 0
        ? {}
        : body.domainErrors.health
          ? { health: body.domainErrors.health }
          : {}),
    },
    source: "cloud",
  }
}

/** Categories that contribute to Mission Control domains. */
export const MISSION_CONTROL_COACH_CATEGORIES: readonly CoachPermissionCategory[] =
  ["body", "vitals", "sleep", "blood", "training", "treatments"]
