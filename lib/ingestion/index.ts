/**
 * Geoffit document ingestion framework.
 *
 * Spine: Upload → user_files → ingest_runs → parser → facts → timeline
 *
 * @see docs/architecture/database/migrations/document-ingestion-framework.md
 */

export type { DocumentKind } from "./document-kind"
export type {
  DocumentParser,
  FactWriter,
  FactWriteResult,
  IngestRunStatus,
  ParseContext,
  ParseResult,
  ParserExecutionMode,
  ProcessIngestOptions,
  ProcessIngestResult,
  StoredFileRef,
  TimelineWriter,
  TimelineWriteResult,
} from "./types"

export {
  getDocumentParser,
  getDocumentParserById,
  hasDocumentParser,
  listDocumentParsers,
  registerDocumentParser,
} from "./registry"

export {
  documentKindForSource,
  sourceUsesIngestionSpine,
} from "./source-map"

export {
  startDocumentIngest,
  retryDocumentIngest,
} from "./client/start-document-ingest"
export type {
  IngestProcessApiResponse,
  StartDocumentIngestInput,
  StartDocumentIngestResult,
} from "./client/start-document-ingest"
