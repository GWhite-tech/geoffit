/**
 * Client-safe confirm path — persists batch + updates health stores.
 * Never parses files.
 */

import type { BloodTest } from "@/lib/domain/blood"
import type { HealthRecord } from "@/lib/domain/health"
import { getBloodStore, getHealthStore } from "@/lib/health"
import { getNutritionStore } from "@/lib/health/nutrition/nutrition-store"
import {
  getWorkoutStore,
  type HevyWorkoutEntry,
} from "@/lib/health/workout"
import {
  ingestAppleHealthPersistBatches,
  readAppleHealthPersistMeta,
} from "@/lib/importers/apple-health/ingest-persist-batches"
import { createClientOrNull } from "@/lib/supabase/client"
import type { ParsedImportData } from "./Importer"
import type { ImportResult } from "./ImportResult"
import { getImportPersistence } from "./persistence"

function extractDomainRecords(parsed: ParsedImportData): HealthRecord[] {
  const fromMetadata = parsed.metadata.domainRecords
  if (Array.isArray(fromMetadata) && fromMetadata.length > 0) {
    return fromMetadata as HealthRecord[]
  }

  const fromPayload: HealthRecord[] = []
  for (const record of parsed.records) {
    const domain = record.payload?.domain
    if (domain && typeof domain === "object" && "type" in domain) {
      fromPayload.push(domain as HealthRecord)
    }
  }
  return fromPayload
}

export async function confirmParsedImport(
  importerId: string,
  parsed: ParsedImportData
): Promise<ImportResult> {
  const metaDomainCount = Array.isArray(parsed.metadata.domainRecords)
    ? (parsed.metadata.domainRecords as unknown[]).length
    : -1

  console.info("[confirmParsedImport] start", {
    importerId,
    fileName: parsed.fileName,
    importRecordCount: parsed.records.length,
    metadataDomainRecords: metaDomainCount,
    metadataKeys: Object.keys(parsed.metadata ?? {}),
  })

  const persistence = getImportPersistence()
  const batch = {
    id: crypto.randomUUID(),
    importerId,
    fileName: parsed.fileName,
    // Audit trail only — Health Store owns the real records.
    records: parsed.records.length > 0 ? parsed.records.slice(0, 20) : [],
    importedAt: new Date().toISOString(),
  }

  const { batchId } = await persistence.saveBatch(batch)
  console.info("[confirmParsedImport] mock batch saved", {
    batchId,
    auditRows: batch.records.length,
    metadataDomainRecords: metaDomainCount,
  })

  let domainRecords = extractDomainRecords(parsed)
  let streamedIngested = 0

  if (importerId === "apple-health") {
    const persist = readAppleHealthPersistMeta(
      parsed.metadata as Record<string, unknown>
    )
    if (persist && persist.batchCount > 0) {
      const supabase = createClientOrNull()
      if (!supabase) {
        throw new Error(
          "Geoffit Cloud is required to finish Apple Health import into your health store."
        )
      }
      const result = await ingestAppleHealthPersistBatches({
        supabase,
        persist,
      })
      streamedIngested = result.ingested
      domainRecords = getHealthStore().getAll()
    } else if (domainRecords.length > 0) {
      await getHealthStore().ingest(domainRecords)
    } else {
      console.warn(
        "[confirmParsedImport] apple-health had no persist batches and no domainRecords"
      )
    }
  } else if (domainRecords.length > 0) {
    await getHealthStore().ingest(domainRecords)
  } else if (importerId === "hevy") {
    const hevyWorkouts = extractHevyWorkouts(parsed)
    if (hevyWorkouts.length > 0) {
      getWorkoutStore().ingest(hevyWorkouts)
      console.info("[confirmParsedImport] WorkoutStore ingested", {
        workouts: hevyWorkouts.length,
        exercises: hevyWorkouts.reduce(
          (sum, workout) => sum + workout.exercises.length,
          0
        ),
        exerciseHistories: getWorkoutStore().getExerciseHistories().length,
      })
    } else {
      console.warn("[confirmParsedImport] Hevy import had no workouts")
    }
  } else if (
    importerId !== "blood-test" &&
    importerId !== "blood-test-screenshots" &&
    importerId !== "blood-test-manual" &&
    importerId !== "progress-photos"
  ) {
    console.warn(
      "[confirmParsedImport] no domainRecords found — falling back to import row payloads"
    )
    await getHealthStore().ingestFromImportRecords(parsed.records)
  } else {
    console.warn(
      "[confirmParsedImport] no HealthRecords to ingest for",
      importerId
    )
  }

  console.info("[confirmParsedImport] HealthStore now has", {
    total: getHealthStore().getRecordCount(),
    hasData: getHealthStore().getSnapshot().hasData,
    streamedIngested,
  })

  getNutritionStore().syncFromHealthRecords(getHealthStore().getAll())
  console.info("[confirmParsedImport] NutritionStore days", {
    days: getNutritionStore().getDays().length,
    dietarySamples: getHealthStore()
      .getAll()
      .filter((record) => String(record.type).startsWith("dietary_")).length,
  })

  const bloodTests = Array.isArray(parsed.metadata.domainBloodTests)
    ? (parsed.metadata.domainBloodTests as BloodTest[])
    : null
  const bloodTest = parsed.metadata.domainBloodTest as BloodTest | undefined

  if (bloodTests && bloodTests.length > 0) {
    getBloodStore().ingest(bloodTests)
  } else if (bloodTest && Array.isArray(bloodTest.markers)) {
    getBloodStore().ingest([bloodTest])
  }

  const bloodMarkerCount = bloodTests
    ? bloodTests.reduce((sum, test) => sum + test.markers.length, 0)
    : bloodTest?.markers.length ?? 0

  const hevyWorkouts =
    importerId === "hevy" ? extractHevyWorkouts(parsed) : []

  const recordCount =
    streamedIngested > 0
      ? streamedIngested
      : hevyWorkouts.length > 0
        ? hevyWorkouts.length
        : domainRecords.length > 0
          ? domainRecords.length
          : bloodMarkerCount > 0
            ? bloodMarkerCount
            : parsed.records.length

  return {
    id: crypto.randomUUID(),
    importerId,
    fileName: parsed.fileName,
    status: "completed",
    batchId,
    recordCount,
    importedAt: batch.importedAt,
    message:
      hevyWorkouts.length > 0
        ? `Imported ${hevyWorkouts.length} Hevy workout${hevyWorkouts.length === 1 ? "" : "s"}.`
        : `Imported ${recordCount} records.`,
  }
}

function extractHevyWorkouts(parsed: ParsedImportData): HevyWorkoutEntry[] {
  if (Array.isArray(parsed.metadata.hevyWorkouts)) {
    return parsed.metadata.hevyWorkouts as HevyWorkoutEntry[]
  }
  const fromPayload: HevyWorkoutEntry[] = []
  for (const record of parsed.records) {
    const workout = record.payload?.workout
    if (workout && typeof workout === "object" && "exercises" in workout) {
      fromPayload.push(workout as HevyWorkoutEntry)
    }
  }
  return fromPayload
}

export async function rollbackImportBatch(
  importerId: string,
  batchId: string
): Promise<ImportResult> {
  const persistence = getImportPersistence()
  const batch = await persistence.getBatch(batchId)

  if (!batch) {
    return {
      id: crypto.randomUUID(),
      importerId,
      fileName: "unknown",
      status: "failed",
      errors: [`Batch ${batchId} not found.`],
      message: "Rollback failed.",
    }
  }

  await persistence.deleteBatch(batchId)

  return {
    id: crypto.randomUUID(),
    importerId,
    fileName: batch.fileName,
    status: "rolled_back",
    batchId,
    recordCount: batch.records.length,
    message: `Rolled back ${batch.records.length} records.`,
  }
}
