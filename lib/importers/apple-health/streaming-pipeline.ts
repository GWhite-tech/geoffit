/**
 * Streaming Apple Health parse pipeline:
 * ZIP/XML byte stream → SAX → map one Record at a time → batch flush → discard.
 *
 * Does not retain prior batches or the full export.xml.
 */

import sax from "sax"

import type { HealthRecord } from "@/lib/domain/health"
import type { ImportRecord } from "@/lib/importers/Importer"

import {
  APPLE_HEALTH_WORKOUT_TYPE,
  isHealthKitTypeIdentifier,
} from "./constants"
import {
  DEFAULT_IMPORT_PROFILE,
  buildEnabledHkTypeSet,
  buildHkTypeToProfileMetric,
  type ImportProfileMetricId,
  type ImportProfileToggles,
} from "./import-profile"
import { logAppleHealthMemory } from "./memory-log"
import {
  domainRecordToImportRecord,
  mapRawElement,
} from "./mapper"
import {
  classifyTypeCounts,
  incrementMetric,
  metricTypeForHkType,
  sumMetrics,
} from "./metric-counts"
import {
  createEmptyFunnel,
  finalizeFunnels,
  funnelKeyForDomainType,
  funnelLabelForDomainType,
  validateMappedRecord,
  type MappingPipelineDiagnostics,
  type TypeMappingFunnel,
} from "./mapping-diagnostics"
import type { AppleHealthParseOptions } from "./progress"
import {
  AppleHealthImportCancelledError,
  EMPTY_METRIC_COUNTS,
  STAGE_MESSAGES,
  buildSearchingFor,
  cloneMetrics,
  createProgressThrottler,
  estimateRemainingSecondsFromEnabledWork,
  yieldToMain,
} from "./progress"
import { openStreamingAppleHealthXml } from "./stream-zip-xml"
import type {
  AppleHealthDiagnostics,
  AppleHealthTypeCount,
  RawAppleHealthAttributes,
  RawAppleHealthElement,
  TypeClassificationBreakdown,
} from "./types"

const TAG_RECORD = "record"
const TAG_WORKOUT = "workout"
const PROFILE_METRIC_BY_HK = buildHkTypeToProfileMetric()
const DEFAULT_BATCH_SIZE = 5_000
const PREVIEW_SAMPLE_LIMIT = 8
const MEMORY_LOG_EVERY_RECORDS = 100_000
/** Leave headroom under Vercel maxDuration before returning a checkpoint. */
const DEFAULT_TIME_BUDGET_MS = 270_000
const DEADLINE_CHECK_EVERY_MAPPED = 2_000

export class AppleHealthTimeBudgetExceededError extends Error {
  readonly recordsMapped: number
  readonly batchesFlushed: number

  constructor(input: { recordsMapped: number; batchesFlushed: number }) {
    super("Apple Health parse stopped for time budget; resume from checkpoint.")
    this.name = "AppleHealthTimeBudgetExceededError"
    this.recordsMapped = input.recordsMapped
    this.batchesFlushed = input.batchesFlushed
  }
}

const ATTRIBUTE_KEY_MAP: Record<string, keyof RawAppleHealthAttributes> = {
  type: "type",
  sourcename: "sourceName",
  sourceversion: "sourceVersion",
  device: "device",
  creationdate: "creationDate",
  startdate: "startDate",
  enddate: "endDate",
  unit: "unit",
  value: "value",
  workoutactivitytype: "workoutActivityType",
  duration: "duration",
  durationunit: "durationUnit",
  totaldistance: "totalDistance",
  totaldistanceunit: "totalDistanceUnit",
  totalenergyburned: "totalEnergyBurned",
  totalenergyburnedunit: "totalEnergyBurnedUnit",
}

function readTypeAttributeFast(
  attributes: Record<string, unknown>
): string | undefined {
  const direct = attributes.type ?? attributes.Type ?? attributes.TYPE
  if (typeof direct === "string" && direct.trim()) return direct.trim()
  for (const [key, value] of Object.entries(attributes)) {
    if (key.toLowerCase() === "type" && typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

function readAttributes(
  attributes: Record<string, unknown>
): RawAppleHealthAttributes {
  const result: RawAppleHealthAttributes = {}
  for (const [key, value] of Object.entries(attributes)) {
    if (typeof value !== "string") continue
    const canonical = ATTRIBUTE_KEY_MAP[key.toLowerCase()]
    if (canonical) result[canonical] = value
  }
  return result
}

function topTypeCounts(
  counts: Map<string, number>,
  limit = 20
): AppleHealthTypeCount[] {
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))
    .slice(0, limit)
}

function buildClassification(
  counts: Map<string, number>,
  enabledHkTypes: Set<string>,
  profileKnownHkTypes: Set<string>
): TypeClassificationBreakdown {
  const { supported, disabled, ignored, unknown, detected } = classifyTypeCounts(
    counts,
    enabledHkTypes,
    profileKnownHkTypes
  )
  return { supported, disabled, ignored, unknown, detected }
}

function ensureFunnel(
  funnels: Map<string, TypeMappingFunnel>,
  key: string,
  label: string
): TypeMappingFunnel {
  let funnel = funnels.get(key)
  if (!funnel) {
    funnel = createEmptyFunnel(key, label)
    funnels.set(key, funnel)
  }
  return funnel
}

export type StreamingAppleHealthOptions = AppleHealthParseOptions & {
  /** Mapped domain records flushed in batches; caller must not retain after resolve. */
  onBatch?: (batch: HealthRecord[]) => void | Promise<void>
  batchSize?: number
  /**
   * Absolute deadline (Date.now() ms). When reached, flush and return
   * incomplete so the caller can checkpoint and resume.
   */
  deadlineAt?: number
  /** Already-persisted mapped records to skip before calling onBatch again. */
  skipMappedRecords?: number
}

export type StreamingAppleHealthResult = {
  format: "zip" | "xml"
  entryPath: string
  /** Preview / confirm sample only — not the full export. */
  domainRecords: HealthRecord[]
  importRecords: ImportRecord[]
  parseWarnings: string[]
  skippedElements: number
  malformedElements: number
  mappingSkipped: number
  mappingFunnel: MappingPipelineDiagnostics
  /** True when stopped early for time budget; more records remain. */
  incomplete: boolean
  diagnostics: Omit<
    AppleHealthDiagnostics,
    | "fileName"
    | "zipEntries"
    | "mappingFunnel"
    | "bodyCompositionTypeDiagnostics"
    | "bodyCompositionSessionCount"
  > & {
    batchesFlushed: number
    recordsMapped: number
    streaming: true
    incomplete: boolean
  }
}

/**
 * Stream-parse an Apple Health export without materialising ZIP contents or XML.
 * Emits / maps Record elements one at a time and flushes batches via onBatch.
 */
export async function runStreamingAppleHealthPipeline(
  file: File,
  options: StreamingAppleHealthOptions = {}
): Promise<StreamingAppleHealthResult> {
  const profile: ImportProfileToggles =
    options.profile ?? DEFAULT_IMPORT_PROFILE
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE
  const deadlineAt =
    options.deadlineAt ?? Date.now() + DEFAULT_TIME_BUDGET_MS
  let skipRemaining = Math.max(0, options.skipMappedRecords ?? 0)
  const enabledHkTypes = buildEnabledHkTypeSet(profile)
  const workoutsEnabled = enabledHkTypes.has(APPLE_HEALTH_WORKOUT_TYPE)
  const profileKnownHkTypes = new Set(PROFILE_METRIC_BY_HK.keys())
  const throttler = createProgressThrottler(options.onProgress)
  const parseStartedAt = Date.now()

  const { chunks, entryPath, format } = await openStreamingAppleHealthXml(file)

  const decoder = new TextDecoder("utf-8")
  const parser = sax.parser(false, {
    lowercase: false,
    trim: true,
    normalize: true,
    xmlns: false,
  })

  const warnings: string[] = []
  const recordTypeCounts = new Map<string, number>()
  const tagNameCounts = new Map<string, number>()
  const skippedByProfileCounts = new Map<ImportProfileMetricId, number>()
  const metrics = cloneMetrics(EMPTY_METRIC_COUNTS)
  const funnels = new Map<string, TypeMappingFunnel>()

  let skippedElements = 0
  let malformedElements = 0
  let mappingSkipped = 0
  let totalXmlElements = 0
  let recordElementCount = 0
  let workoutElementCount = 0
  let bytesProcessed = 0
  let appleHealthDetected = false
  let enabledParsed = 0
  let recordsMapped = 0
  let batchesFlushed = 0
  let incomplete = false
  let nextMemoryLogAt = MEMORY_LOG_EVERY_RECORDS
  let nextDeadlineCheckAt = DEADLINE_CHECK_EVERY_MAPPED

  const previewDomain: HealthRecord[] = []
  const previewImport: ImportRecord[] = []
  let batch: HealthRecord[] = []

  const bumpSkip = (typeKey: string) => {
    const metric = PROFILE_METRIC_BY_HK.get(typeKey)
    if (!metric) return
    skippedByProfileCounts.set(
      metric.id,
      (skippedByProfileCounts.get(metric.id) ?? 0) + 1
    )
  }

  const emitProgress = (force = false) => {
    const classified = classifyTypeCounts(
      recordTypeCounts,
      enabledHkTypes,
      profileKnownHkTypes
    )
    throttler.emit(
      {
        stage: "parsing_xml",
        progress: Math.min(88, 22 + Math.min(66, recordsMapped / 50_000)),
        processedElements: totalXmlElements,
        supportedRecordsFound: sumMetrics(metrics),
        estimatedRemainingTime: estimateRemainingSecondsFromEnabledWork({
          startedAt: parseStartedAt,
          enabledParsed,
          skippedByProfile: [...skippedByProfileCounts.values()].reduce(
            (a, b) => a + b,
            0
          ),
          bytesProcessed,
          xmlByteLength: null,
        }),
        message: appleHealthDetected
          ? "Apple Health detected.\n\nScanning export..."
          : STAGE_MESSAGES.parsing_xml,
        appleHealthDetected,
        foundRecordTypes: classified.detected.slice(0, 12),
        searchingFor: buildSearchingFor(metrics, profile),
        reduction: null,
        metrics: cloneMetrics(metrics),
      },
      force
    )
  }

  const flushBatch = async (final: boolean) => {
    if (batch.length === 0) return
    if (final) {
      logAppleHealthMemory("final_batch", "before", {
        batchSize: batch.length,
        recordsMapped,
        batchesFlushed,
      })
    }
    const toFlush = batch
    batch = []
    await options.onBatch?.(toFlush)
    batchesFlushed += 1
    // Drop references immediately — do not retain previous records.
    toFlush.length = 0
    if (final) {
      logAppleHealthMemory("final_batch", "after", {
        recordsMapped,
        batchesFlushed,
      })
    }
  }

  const stopForTimeBudget = async () => {
    await flushBatch(false)
    incomplete = true
    throw new AppleHealthTimeBudgetExceededError({
      recordsMapped,
      batchesFlushed,
    })
  }

  const acceptMapped = async (record: HealthRecord) => {
    if (incomplete) return
    recordsMapped += 1
    if (skipRemaining > 0) {
      skipRemaining -= 1
      return
    }
    if (previewDomain.length < PREVIEW_SAMPLE_LIMIT) {
      previewDomain.push(record)
      try {
        previewImport.push(domainRecordToImportRecord(record))
      } catch {
        // Preview row optional.
      }
    }
    batch.push(record)
    if (recordsMapped >= nextMemoryLogAt) {
      logAppleHealthMemory("records", "after", {
        recordsMapped,
        batchesFlushed,
        batchBuffered: batch.length,
      })
      nextMemoryLogAt += MEMORY_LOG_EVERY_RECORDS
    }
    if (recordsMapped >= nextDeadlineCheckAt) {
      nextDeadlineCheckAt += DEADLINE_CHECK_EVERY_MAPPED
      if (Date.now() >= deadlineAt) {
        await stopForTimeBudget()
      }
    }
    if (batch.length >= batchSize) {
      await flushBatch(false)
      if (Date.now() >= deadlineAt) {
        await stopForTimeBudget()
      }
    }
  }

  const mapAndAccept = async (element: RawAppleHealthElement) => {
    const provisionalKey =
      element.kind === "workout"
        ? "workout"
        : element.attributes.type ?? "unknown"
    const provisionalLabel =
      element.kind === "workout"
        ? funnelLabelForDomainType("workout")
        : provisionalKey.replace(/^HK\w+TypeIdentifier/, "")

    let record: HealthRecord | null = null
    try {
      record = mapRawElement(element)
    } catch {
      malformedElements += 1
      mappingSkipped += 1
      return
    }

    const funnelKey = record
      ? funnelKeyForDomainType(record.type)
      : provisionalKey
    const funnel = ensureFunnel(
      funnels,
      funnelKey,
      record ? funnelLabelForDomainType(record.type) : provisionalLabel
    )
    funnel.detected += 1

    if (!record) {
      funnel.rejected += 1
      funnel.rejectReasons["Unknown or unmapped type"] =
        (funnel.rejectReasons["Unknown or unmapped type"] ?? 0) + 1
      mappingSkipped += 1
      return
    }

    funnel.mapped += 1
    const validation = validateMappedRecord(record)
    if (!validation.ok) {
      funnel.rejected += 1
      funnel.rejectReasons[validation.reason] =
        (funnel.rejectReasons[validation.reason] ?? 0) + 1
      mappingSkipped += 1
      return
    }
    funnel.validated += 1
    funnel.ready += 1
    await acceptMapped(record)
  }

  // SAX handlers must not be async — queue work onto a chain.
  let chain: Promise<void> = Promise.resolve()
  const enqueueWork = (work: () => Promise<void>) => {
    chain = chain.then(work, work)
  }

  parser.onerror = (error) => {
    malformedElements += 1
    warnings.push(`Malformed XML near line ${parser.line}: ${error.message}`)
    Reflect.set(parser, "error", null)
    parser.resume()
  }

  parser.onopentag = (node) => {
    totalXmlElements += 1
    tagNameCounts.set(node.name, (tagNameCounts.get(node.name) ?? 0) + 1)
    const tag = node.name.toLowerCase()
    const rawAttrs = node.attributes as Record<string, unknown>

    if (tag === TAG_RECORD) {
      recordElementCount += 1
      const typeKey =
        readTypeAttributeFast(rawAttrs) || "(missing type attribute)"
      recordTypeCounts.set(typeKey, (recordTypeCounts.get(typeKey) ?? 0) + 1)
      if (isHealthKitTypeIdentifier(typeKey)) appleHealthDetected = true
      if (!enabledHkTypes.has(typeKey)) {
        skippedElements += 1
        bumpSkip(typeKey)
        return
      }
      try {
        const attributes = readAttributes(rawAttrs)
        attributes.type = typeKey
        const metric = metricTypeForHkType(typeKey)
        if (metric) incrementMetric(metrics, metric)
        enabledParsed += 1
        const element: RawAppleHealthElement = { kind: "record", attributes }
        enqueueWork(() => mapAndAccept(element))
      } catch {
        malformedElements += 1
        warnings.push(`Skipped malformed ${node.name} at line ${parser.line}.`)
      }
      return
    }

    if (tag === TAG_WORKOUT) {
      workoutElementCount += 1
      appleHealthDetected = true
      recordTypeCounts.set(
        APPLE_HEALTH_WORKOUT_TYPE,
        (recordTypeCounts.get(APPLE_HEALTH_WORKOUT_TYPE) ?? 0) + 1
      )
      if (!workoutsEnabled) {
        skippedElements += 1
        bumpSkip(APPLE_HEALTH_WORKOUT_TYPE)
        return
      }
      try {
        const attributes = readAttributes(rawAttrs)
        if (!attributes.startDate || !attributes.endDate) {
          malformedElements += 1
          warnings.push(`Skipped Workout missing dates at line ${parser.line}.`)
          return
        }
        incrementMetric(metrics, "workout")
        enabledParsed += 1
        const element: RawAppleHealthElement = { kind: "workout", attributes }
        enqueueWork(() => mapAndAccept(element))
      } catch {
        malformedElements += 1
        warnings.push(`Skipped malformed ${node.name} at line ${parser.line}.`)
      }
    }
  }

  emitProgress(true)
  await yieldToMain()

  try {
    let chunkIndex = 0
    for await (const chunk of chunks) {
      if (incomplete) break
      if (options.shouldCancel?.()) {
        throw new AppleHealthImportCancelledError()
      }
      if (Date.now() >= deadlineAt) {
        await stopForTimeBudget()
      }
      bytesProcessed += chunk.byteLength
      parser.write(decoder.decode(chunk, { stream: true }))
      // Let mapped batch flushes catch up before pulling more XML.
      await chain
      emitProgress()
      chunkIndex += 1
      if (chunkIndex % 8 === 0) await yieldToMain()
    }

    if (!incomplete) {
      parser.write(decoder.decode())
      parser.close()
      await chain
      await flushBatch(true)
    }
  } catch (error) {
    if (!(error instanceof AppleHealthTimeBudgetExceededError)) {
      throw error
    }
    // Flush chain so in-flight maps settle; incomplete already set.
    await chain.catch(() => undefined)
  }

  emitProgress(true)
  throttler.flush()

  if (recordElementCount === 0 && workoutElementCount === 0) {
    const topTags = topTypeCounts(tagNameCounts, 20)
    if (topTags.length > 0) {
      warnings.push(
        `No <Record>/<Workout> tags found. Top XML tags seen: ${topTags
          .map((entry) => `${entry.type} (${entry.count.toLocaleString()})`)
          .join(", ")}`
      )
    }
  }

  if (incomplete) {
    warnings.push(
      `Parse paused after ${recordsMapped.toLocaleString()} mapped records to stay under the server time limit. Continuing automatically…`
    )
  }

  const classification = buildClassification(
    recordTypeCounts,
    enabledHkTypes,
    profileKnownHkTypes
  )
  const mappingFunnel = finalizeFunnels(funnels)

  return {
    format,
    entryPath,
    domainRecords: previewDomain,
    importRecords: previewImport,
    parseWarnings: warnings,
    skippedElements,
    malformedElements,
    mappingSkipped,
    mappingFunnel,
    incomplete,
    diagnostics: {
      format,
      selectedXmlPath: entryPath,
      xmlByteLength: null,
      totalXmlElements,
      recordElementCount,
      workoutElementCount,
      supportedRecordCount: recordsMapped,
      topRecordTypes: topTypeCounts(recordTypeCounts, 20),
      parseWarnings: warnings,
      malformedElements,
      appleHealthDetected,
      classification,
      batchesFlushed,
      recordsMapped,
      streaming: true,
      incomplete,
    },
  }
}
