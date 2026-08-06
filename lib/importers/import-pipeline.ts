import type { Importer, ImportContext, ParsedImportData } from "./Importer"
import type { ImportPreview, ImportResult } from "./ImportResult"
import type { ValidationResult } from "./Importer"
import { getImportPersistence } from "./persistence"
import { AppleHealthImporter } from "./AppleHealthImporter"
import type { AppleHealthParseOptions } from "./apple-health/progress"
import { AppleHealthImportCancelledError } from "./apple-health/progress"
import { getBloodStore, getHealthStore } from "@/lib/health"
import type { HealthRecord } from "@/lib/domain/health"
import type { BloodTest } from "@/lib/domain/blood"
import {
  getWorkoutStore,
  type HevyWorkoutEntry,
} from "@/lib/health/workout"

export interface ImportPipelinePreview {
  parsed: ParsedImportData
  validation: ValidationResult
  preview: ImportPreview
}

export interface ImportPipelineOptions {
  persistence?: ImportContext["persistence"]
}

export interface GeneratePreviewOptions {
  appleHealth?: AppleHealthParseOptions
}

/**
 * Import pipeline:
 * File → Parse → Validate → Preview → (user confirms) → Persist → ImportResult
 *
 * Blood-test PDFs upload to Supabase Storage; parsing is triggered by file id.
 */
export class ImportPipeline {
  private context: ImportContext

  constructor(options: ImportPipelineOptions = {}) {
    this.context = {
      persistence: options.persistence ?? getImportPersistence(),
    }
  }

  async generatePreview(
    file: File,
    importer: Importer,
    options: GeneratePreviewOptions = {}
  ): Promise<ImportPipelinePreview> {
    const gate = importer.validateFile(file)
    if (!gate.ok) {
      throw new ImportPipelineError(gate.message, [gate.message])
    }

    if (importer.id === "blood-test") {
      throw new ImportPipelineError(
        "Blood-test PDFs must upload to Supabase Storage (see uploadImportFile).",
        [
          "Blood-test PDFs must upload to Supabase Storage (see uploadImportFile).",
        ]
      )
    }

    const parsed =
      importer instanceof AppleHealthImporter
        ? await importer.parse(file, options.appleHealth)
        : await importer.parse(file)

    const validation = importer.validate(parsed)

    if (!validation.valid) {
      throw new ImportPipelineError(
        validation.errors.join("\n\n"),
        validation.errors,
        validation.warnings
      )
    }

    const preview = importer.preview(parsed)

    return { parsed, validation, preview }
  }

  async confirmImport(
    importer: Importer,
    parsed: ParsedImportData
  ): Promise<ImportResult> {
    const result = await importer.import(parsed, this.context)

    if (result.status === "completed") {
      if (importer.id === "hevy") {
        const hevyWorkouts = Array.isArray(parsed.metadata.hevyWorkouts)
          ? (parsed.metadata.hevyWorkouts as HevyWorkoutEntry[])
          : []
        if (hevyWorkouts.length > 0) {
          getWorkoutStore().ingest(hevyWorkouts)
        }
      } else {
        const domainRecords = parsed.metadata.domainRecords
        if (Array.isArray(domainRecords) && domainRecords.length > 0) {
          await getHealthStore().ingest(domainRecords as HealthRecord[])
        } else if (
          importer.id !== "blood-test" &&
          importer.id !== "progress-photos"
        ) {
          await getHealthStore().ingestFromImportRecords(parsed.records)
        }
      }

      const bloodTest = parsed.metadata.domainBloodTest as BloodTest | undefined
      if (bloodTest && Array.isArray(bloodTest.markers)) {
        getBloodStore().ingest([bloodTest])
      }
    }

    return result
  }

  async rollback(importer: Importer, batchId: string): Promise<ImportResult> {
    return importer.rollback(batchId, this.context)
  }
}

export class ImportPipelineError extends Error {
  constructor(
    message: string,
    public readonly errors: string[] = [],
    public readonly warnings: string[] = []
  ) {
    super(message)
    this.name = "ImportPipelineError"
  }
}

export { AppleHealthImportCancelledError }

export const importPipeline = new ImportPipeline()
