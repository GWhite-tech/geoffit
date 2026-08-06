import {
  HEALTH_METRIC_CATEGORIES,
  type HealthRecord,
} from "@/lib/domain/health"
import type { ImportPreview } from "./ImportResult"
import {
  BaseImporter,
  type ParsedImportData,
  type ValidationResult,
} from "./Importer"
import {
  analyzeHealthRecords,
  formatAppleHealthDiagnostics,
  formatTypeCounts,
} from "./apple-health"
import {
  logBodyCompositionDiagnostics,
  mergeBodyCompositionSessions,
} from "./apple-health/body-composition"
import type { BodyCompositionMeasurement } from "@/lib/domain/body-composition"
import type { AppleHealthDiagnostics } from "./apple-health/types"
import type { AppleHealthParseOptions } from "./apple-health/progress"
import {
  EMPTY_METRIC_COUNTS,
  STAGE_MESSAGES,
  buildSearchingFor,
  cloneMetrics,
  createProgressThrottler,
  estimateRemainingSeconds,
  yieldToMain,
} from "./apple-health/progress"
import { sumMetrics } from "./apple-health/metric-counts"
import {
  DEFAULT_IMPORT_PROFILE,
  type ImportProfileToggles,
  type ImportReductionEstimate,
} from "./apple-health/import-profile"
import { runStreamingAppleHealthPipeline } from "./apple-health/streaming-pipeline"

import type { MappingPipelineDiagnostics } from "./apple-health/mapping-diagnostics"

interface AppleHealthMetadata {
  format: "xml" | "zip"
  entryPath?: string | null
  domainRecords: HealthRecord[]
  /** Weighing sessions — nearby body metrics from the same source merged. */
  bodyCompositionMeasurements: BodyCompositionMeasurement[]
  parseWarnings: string[]
  skippedElements: number
  malformedElements: number
  mappingSkipped: number
  analysis: ReturnType<typeof analyzeHealthRecords>
  diagnostics: AppleHealthDiagnostics
  diagnosticReport: string
  profile: ImportProfileToggles
  mappingFunnel: MappingPipelineDiagnostics
}

function progressExtras(
  metrics: ReturnType<typeof cloneMetrics>,
  parseDiagnostics: {
    appleHealthDetected: boolean
    classification: AppleHealthDiagnostics["classification"]
  },
  profile: ImportProfileToggles,
  reduction: ImportReductionEstimate | null
) {
  return {
    appleHealthDetected: parseDiagnostics.appleHealthDetected,
    foundRecordTypes: parseDiagnostics.classification.detected.slice(0, 12),
    searchingFor: buildSearchingFor(metrics, profile),
    reduction,
  }
}

export class AppleHealthImporter extends BaseImporter {
  readonly id = "apple-health"
  readonly name = "Apple Health"
  readonly description = "Apple Health export.xml or export.zip"
  readonly supportedExtensions = [".xml", ".zip"]
  readonly supportedMimeTypes = [
    "application/xml",
    "text/xml",
    "application/zip",
    "application/x-zip-compressed",
  ]
  readonly unsupportedFileMessage =
    "This importer only supports Apple Health .xml or .zip exports."

  async parse(
    file: File,
    options: AppleHealthParseOptions & {
      onBatch?: (batch: HealthRecord[]) => void | Promise<void>
      deadlineAt?: number
      skipMappedRecords?: number
      batchSize?: number
    } = {}
  ): Promise<ParsedImportData> {
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

    const startedAt = Date.now()
    const throttler = createProgressThrottler(options.onProgress)
    const profile = options.profile ?? DEFAULT_IMPORT_PROFILE

    // Streaming ZIP → SAX → map → batch flush (no full archive / XML materialisation).
    const streamed = await runStreamingAppleHealthPipeline(file, {
      ...options,
      profile,
      onBatch: options.onBatch,
    })

    const mappedMetrics = cloneMetrics(EMPTY_METRIC_COUNTS)
    for (const record of streamed.domainRecords) {
      mappedMetrics[record.type] += 1
    }

    const parseDiagnostics = {
      appleHealthDetected: streamed.diagnostics.appleHealthDetected,
      classification: streamed.diagnostics.classification,
      totalXmlElements: streamed.diagnostics.totalXmlElements,
    }

    const reductionFromDisabled =
      parseDiagnostics.classification.disabled.length > 0
        ? {
            skippedByProfile: parseDiagnostics.classification.disabled.reduce(
              (sum, entry) => sum + entry.count,
              0
            ),
            enabledParsed: streamed.diagnostics.recordsMapped,
            estimatedReductionPercent: (() => {
              const skipped = parseDiagnostics.classification.disabled.reduce(
                (sum, entry) => sum + entry.count,
                0
              )
              const total = skipped + streamed.diagnostics.recordsMapped
              return total > 0
                ? Math.min(99, Math.round((skipped / total) * 100))
                : null
            })(),
            topSkipped: parseDiagnostics.classification.disabled
              .slice(0, 3)
              .map((entry) => ({
                id: entry.type as never,
                label: entry.label,
                count: entry.count,
              })),
          }
        : null

    throttler.emit(
      {
        stage: "mapping_records",
        progress: 95,
        processedElements: streamed.diagnostics.totalXmlElements,
        supportedRecordsFound: streamed.diagnostics.recordsMapped,
        estimatedRemainingTime: estimateRemainingSeconds(startedAt, 0.95),
        metrics: mappedMetrics,
        message: STAGE_MESSAGES.mapping_records,
        ...progressExtras(
          mappedMetrics,
          parseDiagnostics,
          profile,
          reductionFromDisabled
        ),
      },
      true
    )
    await yieldToMain()

    throttler.emit(
      {
        stage: "generating_preview",
        progress: 98,
        processedElements: streamed.diagnostics.totalXmlElements,
        supportedRecordsFound: streamed.diagnostics.recordsMapped,
        estimatedRemainingTime: estimateRemainingSeconds(startedAt, 0.98),
        metrics: mappedMetrics,
        message: STAGE_MESSAGES.generating_preview,
        ...progressExtras(
          mappedMetrics,
          parseDiagnostics,
          profile,
          reductionFromDisabled
        ),
      },
      true
    )
    await yieldToMain()

    // Preview sample only — streaming path does not retain the full record set.
    const domainRecords = streamed.domainRecords
    const analysis = analyzeHealthRecords(domainRecords)

    const bodyCompositionMeasurements =
      mergeBodyCompositionSessions(domainRecords)

    const bodyCompositionTypeDiagnostics = logBodyCompositionDiagnostics(
      streamed.diagnostics.topRecordTypes
    )

    const diagnostics: AppleHealthDiagnostics = {
      fileName: file.name,
      format: streamed.format,
      zipEntries: [],
      selectedXmlPath: streamed.entryPath,
      xmlByteLength: null,
      totalXmlElements: streamed.diagnostics.totalXmlElements,
      recordElementCount: streamed.diagnostics.recordElementCount,
      workoutElementCount: streamed.diagnostics.workoutElementCount,
      supportedRecordCount: streamed.diagnostics.recordsMapped,
      topRecordTypes: streamed.diagnostics.topRecordTypes,
      parseWarnings: streamed.diagnostics.parseWarnings,
      malformedElements: streamed.diagnostics.malformedElements,
      appleHealthDetected: streamed.diagnostics.appleHealthDetected,
      classification: streamed.diagnostics.classification,
      mappingFunnel: streamed.mappingFunnel,
      bodyCompositionTypeDiagnostics,
      bodyCompositionSessionCount: bodyCompositionMeasurements.length,
    }

    const diagnosticReport = [
      formatAppleHealthDiagnostics(diagnostics),
      "",
      `Streaming pipeline: batches=${streamed.diagnostics.batchesFlushed}, mapped=${streamed.diagnostics.recordsMapped.toLocaleString()} (full export.xml never materialised)${streamed.incomplete ? " — incomplete, resume required" : ""}.`,
    ].join("\n")
    console.info(diagnosticReport)

    const metadata: AppleHealthMetadata = {
      format: streamed.format,
      entryPath: streamed.entryPath,
      domainRecords,
      bodyCompositionMeasurements,
      parseWarnings: streamed.parseWarnings,
      skippedElements: streamed.skippedElements,
      malformedElements: streamed.malformedElements,
      mappingSkipped: streamed.mappingSkipped,
      analysis,
      diagnostics,
      diagnosticReport,
      profile,
      mappingFunnel: streamed.mappingFunnel,
    }

    throttler.emit(
      {
        stage: "generating_preview",
        progress: streamed.incomplete ? 92 : 100,
        processedElements: streamed.diagnostics.totalXmlElements,
        supportedRecordsFound: streamed.diagnostics.recordsMapped,
        estimatedRemainingTime: streamed.incomplete ? null : 0,
        metrics:
          sumMetrics(mappedMetrics) > 0
            ? mappedMetrics
            : cloneMetrics(EMPTY_METRIC_COUNTS),
        message: streamed.incomplete
          ? "Parse paused under server time limit…"
          : STAGE_MESSAGES.generating_preview,
        ...progressExtras(
          mappedMetrics,
          parseDiagnostics,
          profile,
          reductionFromDisabled
        ),
      },
      true
    )
    throttler.flush()

    return {
      fileName: file.name,
      // Import rows are preview-sized; full set was flushed via onBatch during stream.
      records: streamed.importRecords,
      metadata: {
        ...(metadata as unknown as Record<string, unknown>),
        incomplete: streamed.incomplete,
        recordsMapped: streamed.diagnostics.recordsMapped,
        batchesFlushed: streamed.diagnostics.batchesFlushed,
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
    const warnings: string[] = []
    const metadata = data.metadata as unknown as AppleHealthMetadata

    if (!metadata.diagnostics?.appleHealthDetected) {
      errors.push(
        "This does not appear to be a genuine Apple Health export. No HealthKit record types were detected."
      )
      if (metadata.diagnosticReport) errors.push(metadata.diagnosticReport)
      return { valid: false, errors, warnings }
    }

    const mappedCount = metadata.diagnostics.supportedRecordCount
    if (mappedCount === 0) {
      errors.push(
        "Apple Health export confirmed, but no currently supported records were extracted."
      )
      for (const funnelError of metadata.mappingFunnel?.errors ?? []) {
        errors.push(funnelError)
      }
      errors.push(metadata.diagnosticReport)
    } else {
      for (const funnelError of metadata.mappingFunnel?.errors ?? []) {
        warnings.push(funnelError)
      }
    }

    for (const warning of metadata.parseWarnings ?? []) {
      warnings.push(warning)
    }

    if (metadata.malformedElements > 0) {
      warnings.push(
        `${metadata.malformedElements.toLocaleString()} malformed XML element(s) were skipped.`
      )
    }

    if (metadata.mappingSkipped > 0) {
      warnings.push(
        `${metadata.mappingSkipped.toLocaleString()} element(s) could not be mapped due to missing or invalid fields.`
      )
    }

    if (metadata.analysis.duplicateCount > 0) {
      warnings.push(
        `${metadata.analysis.duplicateCount.toLocaleString()} duplicate record(s) detected across ${metadata.analysis.duplicateGroups.toLocaleString()} group(s).`
      )
    }

    if (mappedCount > 0 && !metadata.analysis.dateRange) {
      warnings.push("Could not determine a date range from extracted records.")
    }

    const ignoredCount = metadata.diagnostics.classification.ignored.length
    if (ignoredCount > 0) {
      warnings.push(
        `${ignoredCount.toLocaleString()} HealthKit type(s) were detected but are not imported yet (see Ignored in diagnostics).`
      )
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  preview(data: ParsedImportData): ImportPreview {
    const metadata = data.metadata as unknown as AppleHealthMetadata
    const categories = [
      ...new Set(
        data.records.map(
          (record) =>
            HEALTH_METRIC_CATEGORIES[
              record.type as keyof typeof HEALTH_METRIC_CATEGORIES
            ] ?? record.category
        )
      ),
    ]

    const dateRangeText = metadata.analysis.dateRange
      ? `${metadata.analysis.dateRange.start} → ${metadata.analysis.dateRange.end}`
      : "unknown range"

    const previewWarnings: string[] = []

    if (metadata.analysis.duplicateCount > 0) {
      previewWarnings.push(
        `Duplicate detection: ${metadata.analysis.duplicateCount.toLocaleString()} duplicate(s) in ${metadata.analysis.duplicateGroups.toLocaleString()} group(s).`
      )
    }

    const recordCount =
      metadata.diagnostics.supportedRecordCount || data.records.length

    return {
      importerId: this.id,
      fileName: data.fileName,
      summary: `${recordCount.toLocaleString()} records · ${dateRangeText} · ${formatTypeCounts(metadata.analysis.countsByType)}`,
      recordCount,
      categories,
      dateRange: metadata.analysis.dateRange ?? undefined,
      duplicateCount: metadata.analysis.duplicateCount,
      countsByType: metadata.analysis.countsByType,
      rows: this.buildPreviewRows(data.records),
      warnings: previewWarnings,
      mappingFunnel: metadata.mappingFunnel.byType.map((funnel) => ({
        key: funnel.key,
        label: funnel.label,
        detected: funnel.detected,
        mapped: funnel.mapped,
        validated: funnel.validated,
        ready: funnel.ready,
        rejected: funnel.rejected,
        primaryRejectReason: funnel.primaryRejectReason,
      })),
    }
  }

  private buildPreviewRows(records: ParsedImportData["records"]) {
    return records.slice(0, 8).map((record) => ({
      id: record.id,
      category: record.category,
      label: record.label,
      value: record.unit ? `${record.value} ${record.unit}` : record.value,
      date: record.date,
    }))
  }
}
