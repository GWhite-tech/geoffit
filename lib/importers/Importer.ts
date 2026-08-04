import type { ImportPreview, ImportResult } from "./ImportResult"

export interface ImportRecord {
  id: string
  type: string
  category: string
  label: string
  value: string
  unit?: string
  date: string
  source: string
  payload: Record<string, unknown>
}

export interface ParsedImportData {
  fileName: string
  records: ImportRecord[]
  metadata: Record<string, unknown>
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export type FileValidationResult =
  | { ok: true }
  | { ok: false; message: string }

export interface ImportBatch {
  id: string
  importerId: string
  fileName: string
  records: ImportRecord[]
  importedAt: string
}

/** Persistence abstraction — importers never touch the database directly. */
export interface ImportPersistence {
  saveBatch(batch: ImportBatch): Promise<{ batchId: string }>
  deleteBatch(batchId: string): Promise<void>
  getBatch(batchId: string): Promise<ImportBatch | null>
}

export interface ImportContext {
  persistence: ImportPersistence
}

export interface Importer {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly supportedExtensions: string[]
  readonly supportedMimeTypes: string[]
  /** Friendly message when the user picks an incompatible file. */
  readonly unsupportedFileMessage: string

  /** Extension/MIME gate — owned by each specialised importer. */
  validateFile(file: File): FileValidationResult
  parse(file: File): Promise<ParsedImportData>
  validate(data: ParsedImportData): ValidationResult
  preview(data: ParsedImportData): ImportPreview
  import(data: ParsedImportData, context: ImportContext): Promise<ImportResult>
  rollback(batchId: string, context: ImportContext): Promise<ImportResult>
}

export abstract class BaseImporter implements Importer {
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly description: string
  abstract readonly supportedExtensions: string[]
  abstract readonly supportedMimeTypes: string[]
  abstract readonly unsupportedFileMessage: string

  abstract parse(file: File): Promise<ParsedImportData>
  abstract validate(data: ParsedImportData): ValidationResult
  abstract preview(data: ParsedImportData): ImportPreview

  validateFile(file: File): FileValidationResult {
    const extension = fileExtension(file)
    const extOk = this.supportedExtensions.some(
      (ext) => ext.replace(".", "").toLowerCase() === extension
    )
    if (extOk) return { ok: true }

    if (file.type) {
      const mimeOk = this.supportedMimeTypes.includes(file.type)
      if (mimeOk) return { ok: true }
    }

    return { ok: false, message: this.unsupportedFileMessage }
  }

  async import(
    data: ParsedImportData,
    context: ImportContext
  ): Promise<ImportResult> {
    const validation = this.validate(data)
    if (!validation.valid) {
      return {
        id: crypto.randomUUID(),
        importerId: this.id,
        fileName: data.fileName,
        status: "failed",
        errors: validation.errors,
        message: "Import validation failed.",
      }
    }

    const batch: ImportBatch = {
      id: crypto.randomUUID(),
      importerId: this.id,
      fileName: data.fileName,
      records: data.records,
      importedAt: new Date().toISOString(),
    }

    const { batchId } = await context.persistence.saveBatch(batch)

    return {
      id: crypto.randomUUID(),
      importerId: this.id,
      fileName: data.fileName,
      status: "completed",
      batchId,
      recordCount: data.records.length,
      importedAt: batch.importedAt,
      preview: this.preview(data),
      message: `Imported ${data.records.length} records.`,
    }
  }

  async rollback(
    batchId: string,
    context: ImportContext
  ): Promise<ImportResult> {
    const batch = await context.persistence.getBatch(batchId)

    if (!batch) {
      return {
        id: crypto.randomUUID(),
        importerId: this.id,
        fileName: "unknown",
        status: "failed",
        errors: [`Batch ${batchId} not found.`],
        message: "Rollback failed.",
      }
    }

    await context.persistence.deleteBatch(batchId)

    return {
      id: crypto.randomUUID(),
      importerId: this.id,
      fileName: batch.fileName,
      status: "rolled_back",
      batchId,
      recordCount: batch.records.length,
      message: `Rolled back ${batch.records.length} records.`,
    }
  }

  protected createRecord(
    partial: Omit<ImportRecord, "id" | "source"> & { source?: string }
  ): ImportRecord {
    return {
      id: crypto.randomUUID(),
      source: partial.source ?? this.id,
      ...partial,
    }
  }
}

export function fileExtension(file: File): string {
  const name = file.name.trim()
  const dot = name.lastIndexOf(".")
  if (dot < 0) return ""
  return name.slice(dot + 1).toLowerCase()
}

/** @deprecated Prefer explicit source selection + importer.validateFile(). */
export function matchesImporter(file: File, importer: Importer): boolean {
  return importer.validateFile(file).ok
}
