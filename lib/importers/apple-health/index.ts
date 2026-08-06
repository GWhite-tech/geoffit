export { analyzeHealthRecords, formatTypeCounts } from "./analysis"
export {
  logBodyCompositionDiagnostics,
  mergeBodyCompositionSessions,
  diagnoseBodyCompositionTypes,
} from "./body-composition"
export type { BodyCompositionTypeDiagnostic } from "./body-composition"
export { formatAppleHealthDiagnostics } from "./diagnostics"
export {
  openAppleHealthXmlStream,
  openStreamingAppleHealthXml,
  openStreamingExportXmlFromZip,
  isPrimaryExportXmlPath,
} from "./extract-xml"
export {
  domainRecordToImportRecord,
  mapElementsToDomain,
  mapElementsToDomainWithDiagnostics,
  parseAppleDate,
} from "./mapper"
export { parseAppleHealthXmlStream } from "./stream-parser"
export { runStreamingAppleHealthPipeline } from "./streaming-pipeline"
export type { AppleHealthDiagnostics } from "./types"
export {
  AppleHealthImportCancelledError,
  EMPTY_METRIC_COUNTS,
  PROGRESS_METRIC_LABELS,
  STAGE_MESSAGES,
  createEmptyProgressEvent,
} from "./progress"
export type {
  AppleHealthImportStage,
  AppleHealthParseOptions,
  AppleHealthProgressEvent,
  SearchingForMetric,
  SupportedMetricCounts,
} from "./progress"
export {
  DEFAULT_IMPORT_PROFILE,
  IMPORT_PROFILE_METRICS,
  createDefaultImportProfile,
} from "./import-profile"
export type {
  ImportProfileMetricId,
  ImportProfileToggles,
  ImportReductionEstimate,
} from "./import-profile"
export type {
  MappingPipelineDiagnostics,
  TypeMappingFunnel,
} from "./mapping-diagnostics"
export { formatMappingFunnelReport } from "./mapping-diagnostics"
