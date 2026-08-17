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
  resumeAppleHealthDocumentIngest,
  isIncompleteIngestResponse,
} from "./client/start-document-ingest"
export type {
  IngestProcessApiResponse,
  StartDocumentIngestInput,
  StartDocumentIngestResult,
  ContinueResumeResult,
} from "./client/start-document-ingest"
export {
  continueAppleHealthIngest,
  findResumableAppleHealthIngest,
  isCloudFactPersistFinished,
  PAUSED_APPLE_HEALTH_INGEST_RUN_IDS,
  decideAfterTransportFailure,
} from "./client/continue-apple-health-ingest"
export type {
  AppleHealthContinueProgress,
  ResumableAppleHealthIngest,
} from "./client/continue-apple-health-ingest"
