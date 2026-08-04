import sax from "sax"

import {
  APPLE_HEALTH_WORKOUT_TYPE,
  isHealthKitTypeIdentifier,
} from "./constants"
import {
  DEFAULT_IMPORT_PROFILE,
  buildEnabledHkTypeSet,
  buildHkTypeToProfileMetric,
  estimateImportReduction,
  type ImportProfileMetricId,
  type ImportProfileToggles,
} from "./import-profile"
import {
  classifyTypeCounts,
  incrementMetric,
  metricTypeForHkType,
  sumMetrics,
} from "./metric-counts"
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
import type {
  AppleHealthParseResult,
  AppleHealthTypeCount,
  RawAppleHealthAttributes,
  RawAppleHealthElement,
  TypeClassificationBreakdown,
} from "./types"

/** Normalised (lowercase) element names we care about. */
const TAG_RECORD = "record"
const TAG_WORKOUT = "workout"

const PROFILE_METRIC_BY_HK = buildHkTypeToProfileMetric()

/** Map normalised attribute names → canonical RawAppleHealthAttributes keys. */
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

/** Fast path: read only the type attribute without allocating a full attribute object. */
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
    if (canonical) {
      result[canonical] = value
    }
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

export interface ParseAppleHealthXmlStreamOptions extends AppleHealthParseOptions {
  /** Total XML byte length for progress / ETA. */
  xmlByteLength?: number | null
  /** Overall progress range for the parsing stage (defaults 22–88). */
  progressRange?: { start: number; end: number }
  parseStartedAt?: number
}

/**
 * Stream-parse Apple Health XML without loading the full document into memory.
 * Only enabled profile record types are fully parsed and retained.
 */
export async function parseAppleHealthXmlStream(
  chunks: AsyncIterable<Uint8Array>,
  options: ParseAppleHealthXmlStreamOptions = {}
): Promise<AppleHealthParseResult> {
  const decoder = new TextDecoder("utf-8")
  const parser = sax.parser(false, {
    lowercase: false,
    trim: true,
    normalize: true,
    xmlns: false,
  })

  const profile: ImportProfileToggles =
    options.profile ?? DEFAULT_IMPORT_PROFILE
  const enabledHkTypes = buildEnabledHkTypeSet(profile)
  const workoutsEnabled = enabledHkTypes.has(APPLE_HEALTH_WORKOUT_TYPE)
  const profileKnownHkTypes = new Set(PROFILE_METRIC_BY_HK.keys())

  const progressRange = options.progressRange ?? { start: 22, end: 88 }
  const parseStartedAt = options.parseStartedAt ?? Date.now()
  const xmlByteLength = options.xmlByteLength ?? null
  const throttler = createProgressThrottler(options.onProgress)

  const elements: RawAppleHealthElement[] = []
  const warnings: string[] = []
  const recordTypeCounts = new Map<string, number>()
  const tagNameCounts = new Map<string, number>()
  const skippedByProfileCounts = new Map<ImportProfileMetricId, number>()
  const metrics = cloneMetrics(EMPTY_METRIC_COUNTS)

  let skippedElements = 0
  let malformedElements = 0
  let totalXmlElements = 0
  let recordElementCount = 0
  let workoutElementCount = 0
  let bytesProcessed = 0
  let loggedFirstParsedElement = false
  let appleHealthDetected = false
  let enabledParsed = 0

  const bumpSkip = (typeKey: string) => {
    const metric = PROFILE_METRIC_BY_HK.get(typeKey)
    if (!metric) return
    skippedByProfileCounts.set(
      metric.id,
      (skippedByProfileCounts.get(metric.id) ?? 0) + 1
    )
  }

  const emitProgress = (force = false) => {
    const fraction =
      xmlByteLength && xmlByteLength > 0
        ? Math.min(1, bytesProcessed / xmlByteLength)
        : Math.min(1, totalXmlElements / 5_000_000)

    const progress =
      progressRange.start +
      (progressRange.end - progressRange.start) * fraction

    const classified = classifyTypeCounts(
      recordTypeCounts,
      enabledHkTypes,
      profileKnownHkTypes
    )
    const reduction = estimateImportReduction(
      skippedByProfileCounts,
      enabledParsed
    )

    throttler.emit(
      {
        stage: "parsing_xml",
        progress: Math.min(progressRange.end, Math.round(progress * 10) / 10),
        processedElements: totalXmlElements,
        supportedRecordsFound: sumMetrics(metrics),
        estimatedRemainingTime: estimateRemainingSecondsFromEnabledWork({
          startedAt: parseStartedAt,
          enabledParsed,
          skippedByProfile: reduction.skippedByProfile,
          bytesProcessed,
          xmlByteLength,
        }),
        metrics: cloneMetrics(metrics),
        message: appleHealthDetected
          ? "Apple Health detected.\n\nScanning export..."
          : STAGE_MESSAGES.parsing_xml,
        appleHealthDetected,
        foundRecordTypes: classified.detected.slice(0, 12),
        searchingFor: buildSearchingFor(metrics, profile),
        reduction,
      },
      force
    )
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

    switch (tag) {
      case TAG_RECORD: {
        recordElementCount += 1

        // Fast path: inspect type only — skip disabled / unsupported immediately.
        const typeKey = readTypeAttributeFast(rawAttrs) || "(missing type attribute)"
        recordTypeCounts.set(typeKey, (recordTypeCounts.get(typeKey) ?? 0) + 1)

        if (isHealthKitTypeIdentifier(typeKey)) {
          appleHealthDetected = true
        }

        if (!enabledHkTypes.has(typeKey)) {
          skippedElements += 1
          bumpSkip(typeKey)
          return
        }

        // Enabled — fully parse attributes and retain for mapping.
        try {
          const attributes = readAttributes(rawAttrs)
          attributes.type = typeKey

          if (!loggedFirstParsedElement) {
            loggedFirstParsedElement = true
            console.info("[AppleHealthParser] First parsed element:", {
              rawTag: node.name,
              normalisedTag: tag,
              attributes,
            })
          }

          const metric = metricTypeForHkType(typeKey)
          if (metric) incrementMetric(metrics, metric)
          enabledParsed += 1
          elements.push({ kind: "record", attributes })
        } catch {
          malformedElements += 1
          warnings.push(`Skipped malformed ${node.name} at line ${parser.line}.`)
        }
        return
      }

      case TAG_WORKOUT: {
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

          if (!loggedFirstParsedElement) {
            loggedFirstParsedElement = true
            console.info("[AppleHealthParser] First parsed element:", {
              rawTag: node.name,
              normalisedTag: tag,
              attributes,
            })
          }

          if (!attributes.startDate || !attributes.endDate) {
            malformedElements += 1
            warnings.push(
              `Skipped Workout missing dates at line ${parser.line}.`
            )
            return
          }

          incrementMetric(metrics, "workout")
          enabledParsed += 1
          elements.push({ kind: "workout", attributes })
        } catch {
          malformedElements += 1
          warnings.push(`Skipped malformed ${node.name} at line ${parser.line}.`)
        }
        return
      }

      default:
        return
    }
  }

  emitProgress(true)
  await yieldToMain()

  let chunkIndex = 0
  for await (const chunk of chunks) {
    if (options.shouldCancel?.()) {
      throw new AppleHealthImportCancelledError()
    }

    bytesProcessed += chunk.byteLength
    parser.write(decoder.decode(chunk, { stream: true }))
    emitProgress()

    chunkIndex += 1
    if (chunkIndex % 4 === 0) {
      await yieldToMain()
    }
  }

  parser.write(decoder.decode())
  parser.close()
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

  const classification = buildClassification(
    recordTypeCounts,
    enabledHkTypes,
    profileKnownHkTypes
  )

  return {
    elements,
    warnings,
    skippedElements,
    malformedElements,
    diagnostics: {
      totalXmlElements,
      recordElementCount,
      workoutElementCount,
      topRecordTypes: topTypeCounts(recordTypeCounts, 20),
      parseWarnings: warnings,
      malformedElements,
      appleHealthDetected,
      classification,
    },
  }
}
