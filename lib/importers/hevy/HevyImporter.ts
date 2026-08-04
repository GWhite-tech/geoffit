/**
 * Hevy CSV importer — foundation for the future Hevy API connector.
 *
 * Parses exported workout CSVs into WorkoutStore entries (source: Hevy).
 * Merge with Apple Health physiology happens in WorkoutMergeEngine,
 * not in this importer.
 */

import type { ImportPreview } from "../ImportResult"
import {
  BaseImporter,
  type ParsedImportData,
  type ValidationResult,
} from "../Importer"
import { parseHevyWorkoutCsv } from "./parse-csv"

export class HevyImporter extends BaseImporter {
  readonly id = "hevy"
  readonly name = "Hevy"
  readonly description =
    "Hevy workout export CSV — strength structure for Geoffit"
  readonly supportedExtensions = [".csv"]
  readonly supportedMimeTypes = ["text/csv", "application/csv", "text/plain"]
  readonly unsupportedFileMessage =
    "This importer only supports Hevy workout export CSV files."

  async parse(file: File): Promise<ParsedImportData> {
    const gate = this.validateFile(file)
    if (!gate.ok) {
      return {
        fileName: file.name,
        records: [],
        metadata: {
          fileRejected: true,
          rejectMessage: gate.message,
        },
      }
    }

    const text = await file.text()
    const parsed = parseHevyWorkoutCsv(text)

    const records = parsed.workouts.map((workout) =>
      this.createRecord({
        type: "workout",
        category: "Strength",
        label: workout.name,
        value: `${workout.exercises.length} exercises · ${Math.round(workout.durationSeconds / 60)} min`,
        unit:
          workout.volumeKg != null
            ? `${Math.round(workout.volumeKg)} kg vol`
            : undefined,
        date: workout.startDate,
        source: "hevy",
        payload: {
          // Never tag csv vs api — WorkoutStore is the only destination.
          connector: "hevy",
          workout,
        },
      })
    )

    return {
      fileName: file.name,
      records,
      metadata: {
        hevyWorkouts: parsed.workouts,
        rowCount: parsed.rowCount,
        workoutCount: parsed.workouts.length,
        exerciseCount: parsed.exerciseCount,
        setCount: parsed.setCount,
        warnings: parsed.warnings,
        dateRange: parsed.dateRange,
      },
    }
  }

  validate(data: ParsedImportData): ValidationResult {
    if (data.metadata.fileRejected) {
      return {
        valid: false,
        errors: [
          typeof data.metadata.rejectMessage === "string"
            ? data.metadata.rejectMessage
            : this.unsupportedFileMessage,
        ],
        warnings: [],
      }
    }

    const errors: string[] = []
    const warnings = Array.isArray(data.metadata.warnings)
      ? [...(data.metadata.warnings as string[])]
      : []

    const workouts = data.metadata.hevyWorkouts
    if (!Array.isArray(workouts) || workouts.length === 0) {
      errors.push(
        "No Hevy workouts found. Export workouts from Hevy (Settings → Export Data → Export Workouts)."
      )
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  preview(data: ParsedImportData): ImportPreview {
    const workouts = Array.isArray(data.metadata.hevyWorkouts)
      ? (data.metadata.hevyWorkouts as Array<{
          id: string
          name: string
          startDate: string
          exercises: unknown[]
          volumeKg?: number
          durationSeconds: number
        }>)
      : []

    const exerciseCount =
      typeof data.metadata.exerciseCount === "number"
        ? data.metadata.exerciseCount
        : workouts.reduce((sum, w) => sum + w.exercises.length, 0)
    const setCount =
      typeof data.metadata.setCount === "number"
        ? data.metadata.setCount
        : null

    const dateRange =
      data.metadata.dateRange &&
      typeof data.metadata.dateRange === "object" &&
      data.metadata.dateRange !== null &&
      "start" in data.metadata.dateRange &&
      "end" in data.metadata.dateRange
        ? (data.metadata.dateRange as { start: string; end: string })
        : undefined

    return {
      importerId: this.id,
      fileName: data.fileName,
      summary: `${workouts.length} Hevy workout${workouts.length === 1 ? "" : "s"} · ${exerciseCount} exercises${
        setCount != null ? ` · ${setCount} sets` : ""
      }. Merges with overlapping Apple Health strength sessions.`,
      recordCount: workouts.length,
      categories: ["Strength", "Hevy"],
      rows: workouts.slice(0, 12).map((workout) => ({
        id: workout.id,
        category: "Strength",
        label: workout.name,
        value:
          workout.volumeKg != null
            ? `${workout.exercises.length} ex · ${Math.round(workout.volumeKg)} kg`
            : `${workout.exercises.length} exercises`,
        date: workout.startDate.slice(0, 10),
      })),
      warnings: Array.isArray(data.metadata.warnings)
        ? (data.metadata.warnings as string[])
        : [],
      dateRange,
      countsByType: {
        workouts: workouts.length,
        exercises: exerciseCount,
        ...(setCount != null ? { sets: setCount } : {}),
      },
    }
  }
}
