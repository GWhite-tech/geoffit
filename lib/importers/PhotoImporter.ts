import type { ImportPreview } from "./ImportResult"
import {
  BaseImporter,
  type ParsedImportData,
  type ValidationResult,
} from "./Importer"

/**
 * Progress photo importer — accepts images and stages them for review.
 * Full physique analysis / storage arrives later.
 */
export class PhotoImporter extends BaseImporter {
  readonly id = "progress-photos"
  readonly name = "Progress Photos"
  readonly description = "Progress and physique photos"
  readonly supportedExtensions = [".jpg", ".jpeg", ".png", ".heic"]
  readonly supportedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/heic",
    "image/heif",
  ]
  readonly unsupportedFileMessage =
    "This importer only supports JPG, PNG, and HEIC progress photos."

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

    const record = this.createRecord({
      type: "progress_photo",
      category: "Progress Photos",
      label: file.name,
      value: `${Math.round(file.size / 1024)} KB`,
      date: new Date(file.lastModified).toISOString().slice(0, 10),
      payload: {
        mimeType: file.type || null,
        sizeBytes: file.size,
        extension: file.name.split(".").pop()?.toLowerCase() ?? null,
      },
    })

    return {
      fileName: file.name,
      records: [record],
      metadata: {
        photoCount: 1,
        mimeType: file.type,
        sizeBytes: file.size,
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
    const warnings: string[] = [
      "Photo import stores the file metadata for now. Physique analysis arrives later.",
    ]

    if (data.records.length === 0) {
      errors.push("No photo was found to import.")
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  preview(data: ParsedImportData): ImportPreview {
    return {
      importerId: this.id,
      fileName: data.fileName,
      summary: `1 progress photo ready to import.`,
      recordCount: data.records.length,
      categories: ["Progress Photos"],
      rows: data.records.map((record) => ({
        id: record.id,
        category: record.category,
        label: record.label,
        value: record.value,
        date: record.date,
      })),
      warnings: [
        "Review the photo selection before confirming. Analysis features are coming soon.",
      ],
    }
  }
}
