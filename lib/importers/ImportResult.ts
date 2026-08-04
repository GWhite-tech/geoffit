export type ImportStatus =
  | "pending"
  | "validated"
  | "preview_ready"
  | "completed"
  | "failed"
  | "rolled_back"

export interface ImportPreviewRow {
  id: string
  category: string
  label: string
  value: string
  date?: string
  /** Blood / lab status when applicable. */
  status?: string
}

export interface ImportPreview {
  importerId: string
  fileName: string
  summary: string
  recordCount: number
  categories: string[]
  rows: ImportPreviewRow[]
  warnings: string[]
  dateRange?: {
    start: string
    end: string
  }
  duplicateCount?: number
  countsByType?: Record<string, number>
  mappingFunnel?: Array<{
    key: string
    label: string
    detected: number
    mapped: number
    validated: number
    ready: number
    rejected: number
    primaryRejectReason: string | null
  }>
}

export interface ImportResult {
  id: string
  importerId: string
  fileName: string
  status: ImportStatus
  preview?: ImportPreview
  importedAt?: string
  recordCount?: number
  batchId?: string
  errors?: string[]
  message?: string
}

export function createImportResult(
  partial: Omit<ImportResult, "id"> & { id?: string }
): ImportResult {
  return {
    id: partial.id ?? crypto.randomUUID(),
    ...partial,
  }
}
