/**
 * Repository-backed FactWriter (PR3).
 * Cloud upserts via PR2 repositories; local stores unchanged (confirm path).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { createCloudRepositories } from "@/lib/cloud"
import type { WriteContext } from "@/lib/cloud"
import type { BloodTest } from "@/lib/domain/blood"
import type { HevyWorkoutEntry } from "@/lib/health/workout/workout-store"
import { readAppleHealthPersistMeta } from "@/lib/importers/apple-health/ingest-persist-batches"

import type { DocumentKind, FactWriteResult, FactWriter, ParseResult } from "../types"
import { persistAppleHealthBatchesToCloud } from "./apple-health-cloud-persist"
import { readCloudFactPersist } from "./cloud-fact-persist"

function writeContext(input: {
  userId: string
  ingestRunId: string
  userFileId?: string
  documentKind: DocumentKind
}): WriteContext {
  return {
    userId: input.userId,
    ingestRunId: input.ingestRunId,
    userFileId: input.userFileId ?? null,
    parserVersion: `parser.${input.documentKind}`,
    connectorVersion: "geoffit-ingest-spine",
  }
}

function extractBloodTests(parseResult: ParseResult): BloodTest[] {
  const meta = parseResult.payload?.metadata as
    | Record<string, unknown>
    | undefined
  if (!meta) return []
  if (Array.isArray(meta.domainBloodTests)) {
    return meta.domainBloodTests as BloodTest[]
  }
  const single = meta.domainBloodTest as BloodTest | undefined
  if (single && Array.isArray(single.markers)) return [single]
  return []
}

function extractHevyWorkouts(parseResult: ParseResult): HevyWorkoutEntry[] {
  const meta = parseResult.payload?.metadata as
    | Record<string, unknown>
    | undefined
  if (!meta) return []
  if (Array.isArray(meta.hevyWorkouts)) {
    return meta.hevyWorkouts as HevyWorkoutEntry[]
  }
  return []
}

export function createRepositoryFactWriter(
  supabase: SupabaseClient
): FactWriter {
  return {
    id: "repository-cloud-facts",
    async write(input): Promise<FactWriteResult> {
      if (!input.parseResult.success || !input.parseResult.payload) {
        return { written: 0, skipped: 0, errors: [] }
      }

      const ctx = writeContext({
        userId: input.userId,
        ingestRunId: input.ingestRunId,
        userFileId: input.userFileId,
        documentKind: input.documentKind,
      })

      if (input.documentKind === "blood_lab_pdf") {
        const tests = extractBloodTests(input.parseResult)
        if (tests.length === 0) {
          return {
            written: 0,
            skipped: 0,
            errors: ["Blood parse succeeded but no BloodTest payload found."],
          }
        }
        const repos = createCloudRepositories(supabase)
        const result = await repos.blood.upsertTests(tests, ctx)
        return {
          written: result.written,
          skipped: result.skipped,
          errors: [],
        }
      }

      if (input.documentKind === "hevy_csv") {
        const workouts = extractHevyWorkouts(input.parseResult)
        if (workouts.length === 0) {
          return {
            written: 0,
            skipped: 0,
            errors: ["Hevy parse succeeded but no workouts payload found."],
          }
        }
        const repos = createCloudRepositories(supabase)
        const result = await repos.workouts.upsertHevyMany(workouts, ctx)
        return {
          written: result.written,
          skipped: result.skipped,
          errors: [],
        }
      }

      if (input.documentKind === "apple_health_export") {
        const meta = input.parseResult.payload.metadata as
          | Record<string, unknown>
          | undefined
        const persist =
          readAppleHealthPersistMeta(meta) ??
          readAppleHealthPersistMeta(
            input.parseResult.diagnostics &&
              typeof input.parseResult.diagnostics === "object"
              ? (input.parseResult.diagnostics as Record<string, unknown>)
              : null
          )
        if (!persist) {
          return {
            written: 0,
            skipped: 0,
            errors: [
              "Apple Health parse succeeded but persist batch metadata is missing.",
            ],
          }
        }
        // Parse still incomplete — Storage batches may grow; wait until parse done.
        if (persist.complete === false) {
          return {
            written: 0,
            skipped: 0,
            errors: [],
            incomplete: true,
            cloudFactPersist: readCloudFactPersist(input.priorStats) ?? {
              version: 1,
              documentKind: "apple_health_export",
              nextBatchIndex: 0,
              batchCount: persist.batchCount,
              recordsWritten: 0,
              workoutsWritten: 0,
              nutritionDaysWritten: 0,
              complete: false,
              lastError: null,
            },
          }
        }

        const priorState = readCloudFactPersist(input.priorStats)
        const result = await persistAppleHealthBatchesToCloud({
          supabase,
          persist,
          priorState,
          ctx,
        })
        return {
          written: result.written,
          skipped: result.skipped,
          errors: result.errors,
          incomplete: result.incomplete,
          cloudFactPersist: result.state,
        }
      }

      return { written: 0, skipped: 0, errors: [] }
    },
  }
}
