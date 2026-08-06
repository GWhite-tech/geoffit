/**
 * Client-safe public barrel for import UI.
 * Do not re-export Apple Health / CSV / PDF parsers from here —
 * those run only under lib/server/importers and /api/import/*.
 */

export type {
  ImportPreview,
  ImportPreviewRow,
  ImportResult,
  ImportStatus,
} from "./ImportResult"
export { createImportResult } from "./ImportResult"

export type {
  FileValidationResult,
  ImportBatch,
  ImportContext,
  ImportPersistence,
  ImportRecord,
  Importer,
  ParsedImportData,
  ValidationResult,
} from "./Importer"
export { BaseImporter, fileExtension, matchesImporter } from "./Importer"

export {
  DATA_SOURCES,
  getDataSource,
} from "./sources"
export type { DataSourceDefinition, DataSourceId } from "./sources"

export {
  uploadImportFile,
  toClientImportPreview,
  getImportEndpoint,
  extensionAllowed,
  usesDirectStorageUpload,
} from "./client-upload"
export type {
  ClientImportApiResponse,
  ClientImportPreview,
} from "./client-upload"

export {
  confirmParsedImport,
  rollbackImportBatch,
} from "./confirm-import"

export {
  getImportPersistence,
  MockImportPersistence,
} from "./persistence"
