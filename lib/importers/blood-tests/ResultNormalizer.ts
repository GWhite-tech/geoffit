/**
 * Normalise OCR'd screenshot text into review rows and BloodTest domain models.
 * Layout-agnostic: relies on biomarker recognition, not provider UI structure.
 */

import type {
  BloodMarker,
  BloodMarkerStatus,
  BloodReferenceRange,
  BloodTest,
} from "@/lib/domain/blood"
import {
  findBiomarkerInLine,
  matchBiomarker,
  slugifyUnknownBiomarker,
  type CanonicalBiomarker,
} from "./BiomarkerMatcher"

export const LOW_OCR_CONFIDENCE = 0.65

export interface ScreenshotObservation {
  id: string
  date: string
  biomarkerName: string
  biomarkerKey: string
  registryId?: string
  value: number | null
  unit: string
  referenceRange: BloodReferenceRange
  status: BloodMarkerStatus
  confidence: number
  sourceFileName: string
  unknownBiomarker: boolean
  duplicate: boolean
}

export interface ScreenshotReviewRow {
  id: string
  date: string
  biomarker: string
  biomarkerKey: string
  value: string
  unit: string
  referenceRange: string
  status: BloodMarkerStatus
  confidence: number
  sourceFileName: string
  unknownBiomarker: boolean
  duplicate: boolean
  /** Soft-deleted / skipped by user during review. */
  excluded?: boolean
}

export interface ScreenshotImportDiagnostics {
  screensProcessed: number
  biomarkersDetected: number
  unknownBiomarkers: number
  duplicateResults: number
  averageOcrConfidence: number
  lowConfidenceCount: number
  sourceFiles: string[]
}

export interface ScreenshotTextChunk {
  text: string
  confidence: number
  sourceFileName: string
}

const UI_CHROME_RE =
  /^(home|back|search|menu|settings|notifications?|inbox|share|export|print|done|cancel|ok|close|nhs app|patient access|my chart|results|tests|overview|summary)$/i

const DATE_PATTERNS: Array<{
  re: RegExp
  parse: (match: RegExpMatchArray) => string | null
}> = [
  {
    re: /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/,
    parse: (m) => toIsoDate(Number(m[3]), Number(m[2]), Number(m[1])),
  },
  {
    re: /\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/,
    parse: (m) => toIsoDate(Number(m[1]), Number(m[2]), Number(m[3])),
  },
  {
    re: /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/i,
    parse: (m) =>
      toIsoDate(Number(m[3]), monthIndex(m[2]!), Number(m[1])),
  },
  {
    re: /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/i,
    parse: (m) =>
      toIsoDate(Number(m[3]), monthIndex(m[1]!), Number(m[2])),
  },
  {
    // Year-only context (history lists) — Jan 1 of that year as a soft date.
    re: /^\s*(19|20)\d{2}\s*$/,
    parse: (m) => `${m[0]!.trim()}-01-01`,
  },
]

const UNIT_TOKEN_RE =
  /^(mmol\/(?:mol|l)|nmol\/l|pmol\/l|umol\/l|µmol\/l|mg\/(?:l|dl)|g\/(?:l|dl)|u\/l|mu\/l|ng\/(?:ml|l)|ug\/l|µg\/l|%|ratio|x10[\^⁰¹²⁹⁴9]*\/l|×10[⁰¹²⁹]+\/l|ml\/min(?:\/1\.73m²?)?)$/i

const RANGE_RE =
  /([<>]?\s*\d+(?:\.\d+)?\s*[-–—]\s*\d+(?:\.\d+)?)|([<>]\s*\d+(?:\.\d+)?)/

const STATUS_RE = /\b(normal|high|low|critical|abnormal|out of range|borderline)\b/i

function monthIndex(raw: string): number {
  const key = raw.slice(0, 3).toLowerCase()
  const map: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  }
  return map[key] ?? 0
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (!year || !month || !day) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function normaliseUnit(unit: string): string {
  const u = unit.trim().replace(/\s+/g, "")
  const upper = u.toUpperCase()
  if (/X10.?9\/L|×10⁹\/L/i.test(upper)) return "×10⁹/L"
  if (/X10.?12\/L|×10¹²\/L/i.test(upper)) return "×10¹²/L"
  if (/ML\/MIN/i.test(upper)) return "mL/min/1.73m²"
  if (upper === "MMOL/L") return "mmol/L"
  if (upper === "MMOL/MOL") return "mmol/mol"
  if (upper === "NMOL/L") return "nmol/L"
  if (upper === "PMOL/L") return "pmol/L"
  if (upper === "UMOL/L" || upper === "µMOL/L") return "umol/L"
  if (upper === "MU/L") return "mU/L"
  if (upper === "U/L") return "U/L"
  if (upper === "G/L") return "g/L"
  if (upper === "G/DL") return "g/dL"
  if (upper === "MG/L") return "mg/L"
  if (upper === "MG/DL") return "mg/dL"
  if (upper === "NG/ML") return "ng/mL"
  if (upper === "NG/L") return "ng/L"
  if (upper === "UG/L" || upper === "µg/L") return "ug/L"
  if (upper === "%") return "%"
  return unit.trim()
}

export function parseReferenceRangeText(text: string): BloodReferenceRange {
  const cleaned = text.trim()
  if (!cleaned || cleaned === "—" || cleaned === "-") {
    return { text: "—" }
  }

  const between = cleaned.match(
    /(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)/
  )
  if (between) {
    return {
      text: `${between[1]}-${between[2]}`,
      low: Number(between[1]),
      high: Number(between[2]),
    }
  }

  const lt = cleaned.match(/<\s*(\d+(?:\.\d+)?)/)
  if (lt) {
    return { text: `<${lt[1]}`, high: Number(lt[1]) }
  }

  const gt = cleaned.match(/>\s*(\d+(?:\.\d+)?)/)
  if (gt) {
    return { text: `>${gt[1]}`, low: Number(gt[1]) }
  }

  return { text: cleaned }
}

export function inferStatus(
  value: number | null,
  range: BloodReferenceRange,
  explicit?: string
): BloodMarkerStatus {
  if (explicit) {
    const s = explicit.toLowerCase()
    if (s.includes("critical")) return "critical"
    if (s.includes("high") || s.includes("above") || s.includes("abnormal"))
      return "high"
    if (s.includes("low") || s.includes("below")) return "low"
    if (s.includes("borderline")) return "review"
    if (s.includes("normal") || s.includes("within")) return "normal"
  }

  if (value == null || !Number.isFinite(value)) return "unknown"
  if (range.low != null && value < range.low) return "low"
  if (range.high != null && value > range.high) return "high"
  if (range.low != null || range.high != null) return "normal"
  return "unknown"
}

function extractDateFromLine(line: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = line.match(pattern.re)
    if (!match) continue
    const iso = pattern.parse(match)
    if (iso) return iso
  }
  return null
}

function parseNumericToken(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim()
  if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function stripUiChrome(lines: string[]): string[] {
  return lines.filter((line) => {
    const t = line.trim()
    if (!t) return false
    if (UI_CHROME_RE.test(t)) return false
    if (/^page\s+\d+/i.test(t)) return false
    return true
  })
}

interface PendingMarker {
  biomarker: CanonicalBiomarker | null
  rawName: string
  unknown: boolean
}

/**
 * Extract biomarker observations from combined OCR text chunks.
 * Multiple dates for the same biomarker become separate observations (trends).
 */
export function extractObservationsFromChunks(
  chunks: ScreenshotTextChunk[]
): ScreenshotObservation[] {
  const observations: ScreenshotObservation[] = []

  for (const chunk of chunks) {
    const lines = stripUiChrome(
      chunk.text
        .replace(/\r/g, "\n")
        .split(/\n+/)
        .map((l) => l.replace(/\s+/g, " ").trim())
    )

    let currentDate = "unknown"
    let pending: PendingMarker | null = null
    let lastBiomarker: PendingMarker | null = null

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      const dateOnLine = extractDateFromLine(line)
      if (dateOnLine) {
        currentDate = dateOnLine
        // Year-only line with a following number may be a history point:
        // "2022" / "48"
        const yearOnly = /^\s*(19|20)\d{2}\s*$/.test(line)
        const historyTarget = pending ?? lastBiomarker
        if (yearOnly && historyTarget) {
          const next = lines[i + 1]
          const value = next ? parseNumericToken(next.split(/\s+/)[0] ?? "") : null
          if (value != null) {
            observations.push(
              buildObservation({
                date: currentDate,
                pending: historyTarget,
                value,
                unit: historyTarget.biomarker?.defaultUnit ?? "",
                rangeText: "—",
                statusText: undefined,
                confidence: chunk.confidence * 0.85,
                sourceFileName: chunk.sourceFileName,
              })
            )
            i += 1
            continue
          }
        }
      }

      const biomarkerHit = findBiomarkerInLine(line)

      if (biomarkerHit) {
        pending = {
          biomarker: biomarkerHit.biomarker,
          rawName: biomarkerHit.biomarker.displayName,
          unknown: false,
        }
        lastBiomarker = pending
      } else if (
        !dateOnLine &&
        /^[A-Za-z][A-Za-z0-9 +\-\/()]{1,40}$/.test(line) &&
        !UNIT_TOKEN_RE.test(line) &&
        !STATUS_RE.test(line)
      ) {
        const matched = matchBiomarker(line)
        pending = matched
          ? {
              biomarker: matched.biomarker,
              rawName: matched.biomarker.displayName,
              unknown: false,
            }
          : {
              biomarker: null,
              rawName: line,
              unknown: true,
            }
        lastBiomarker = pending
      }

      const inline = parseInlineResult(line, pending, currentDate, chunk)
      if (inline) {
        observations.push(inline.observation)
        if (inline.consumedPending) {
          lastBiomarker = pending ?? lastBiomarker
          pending = null
        }
        continue
      }

      // Marker on this line, value on next:
      if (pending && biomarkerHit) {
        const next = lines[i + 1]
        if (next) {
          const fromNext = parseValueLine(next, pending, currentDate, chunk)
          if (fromNext) {
            observations.push(fromNext)
            lastBiomarker = pending
            pending = null
            i += 1
          }
        }
      }
    }
  }

  return markDuplicates(observations)
}

function parseInlineResult(
  line: string,
  pending: PendingMarker | null,
  currentDate: string,
  chunk: ScreenshotTextChunk
): { observation: ScreenshotObservation; consumedPending: boolean } | null {
  const biomarkerHit = findBiomarkerInLine(line)
  const active: PendingMarker | null = biomarkerHit
    ? {
        biomarker: biomarkerHit.biomarker,
        rawName: biomarkerHit.biomarker.displayName,
        unknown: false,
      }
    : pending

  if (!active) return null

  // Remove biomarker name then look for number / unit / range / status.
  let rest = line
  if (biomarkerHit) {
    const re = new RegExp(biomarkerHit.rawName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    rest = rest.replace(re, " ").replace(/\s+/g, " ").trim()
  }

  const statusMatch = rest.match(STATUS_RE)
  const statusText = statusMatch?.[1]
  if (statusMatch) {
    rest = rest.replace(statusMatch[0], " ").replace(/\s+/g, " ").trim()
  }

  const rangeMatch = rest.match(RANGE_RE)
  const rangeText = rangeMatch?.[0]?.trim() ?? "—"
  if (rangeMatch) {
    rest = rest.replace(rangeMatch[0], " ").replace(/\s+/g, " ").trim()
  }

  const tokens = rest.split(/\s+/).filter(Boolean)
  let value: number | null = null
  let unit = active.biomarker?.defaultUnit ?? ""
  const leftover: string[] = []

  for (const token of tokens) {
    if (value == null) {
      const n = parseNumericToken(token)
      if (n != null) {
        value = n
        continue
      }
    }
    if (UNIT_TOKEN_RE.test(token.replace(/\s+/g, ""))) {
      unit = normaliseUnit(token)
      continue
    }
    leftover.push(token)
  }

  // "42mmol/mol" glued
  if (value == null) {
    const glued = rest.match(/(-?\d+(?:\.\d+)?)([A-Za-zµμ%].*)/)
    if (glued) {
      value = Number(glued[1])
      unit = normaliseUnit(glued[2]!)
    }
  }

  if (value == null) return null

  return {
    observation: buildObservation({
      date: extractDateFromLine(line) ?? currentDate,
      pending: active,
      value,
      unit,
      rangeText,
      statusText,
      confidence:
        chunk.confidence *
        (biomarkerHit?.matchKind === "exact"
          ? 1
          : biomarkerHit?.matchKind === "alias"
            ? 0.95
            : 0.85),
      sourceFileName: chunk.sourceFileName,
    }),
    consumedPending: true,
  }
}

function parseValueLine(
  line: string,
  pending: PendingMarker,
  currentDate: string,
  chunk: ScreenshotTextChunk
): ScreenshotObservation | null {
  if (findBiomarkerInLine(line)) return null

  const dateOnLine = extractDateFromLine(line)
  let rest = line
  if (dateOnLine) {
    // strip first date occurrence
    rest = rest.replace(DATE_PATTERNS[0]!.re, " ").trim()
  }

  const statusMatch = rest.match(STATUS_RE)
  const statusText = statusMatch?.[1]
  if (statusMatch) rest = rest.replace(statusMatch[0], " ").trim()

  const rangeMatch = rest.match(RANGE_RE)
  const rangeText = rangeMatch?.[0]?.trim() ?? "—"
  if (rangeMatch) rest = rest.replace(rangeMatch[0], " ").trim()

  const tokens = rest.split(/\s+/).filter(Boolean)
  let value: number | null = null
  let unit = pending.biomarker?.defaultUnit ?? ""

  for (const token of tokens) {
    if (value == null) {
      const n = parseNumericToken(token)
      if (n != null) {
        value = n
        continue
      }
    }
    if (UNIT_TOKEN_RE.test(token.replace(/\s+/g, ""))) {
      unit = normaliseUnit(token)
    }
  }

  if (value == null) {
    const glued = rest.match(/(-?\d+(?:\.\d+)?)([A-Za-zµμ%].*)/)
    if (glued) {
      value = Number(glued[1])
      unit = normaliseUnit(glued[2]!)
    }
  }

  if (value == null) return null

  return buildObservation({
    date: dateOnLine ?? currentDate,
    pending,
    value,
    unit,
    rangeText,
    statusText,
    confidence: chunk.confidence * 0.9,
    sourceFileName: chunk.sourceFileName,
  })
}

function buildObservation(input: {
  date: string
  pending: PendingMarker
  value: number
  unit: string
  rangeText: string
  statusText?: string
  confidence: number
  sourceFileName: string
}): ScreenshotObservation {
  const range = parseReferenceRangeText(input.rangeText)
  const name =
    input.pending.biomarker?.displayName ?? input.pending.rawName
  const key =
    input.pending.biomarker?.key ?? slugifyUnknownBiomarker(input.pending.rawName)

  return {
    id: crypto.randomUUID(),
    date: input.date,
    biomarkerName: name,
    biomarkerKey: key,
    registryId: input.pending.biomarker?.registryId,
    value: input.value,
    unit: input.unit || input.pending.biomarker?.defaultUnit || "",
    referenceRange: range,
    status: inferStatus(input.value, range, input.statusText),
    confidence: Math.max(0, Math.min(1, input.confidence)),
    sourceFileName: input.sourceFileName,
    unknownBiomarker: input.pending.unknown || !input.pending.biomarker,
    duplicate: false,
  }
}

function markDuplicates(
  observations: ScreenshotObservation[]
): ScreenshotObservation[] {
  const seen = new Map<string, string>()
  return observations.map((obs) => {
    const fingerprint = [
      obs.biomarkerKey,
      obs.date,
      obs.value,
      obs.unit.toLowerCase(),
    ].join("|")
    const existing = seen.get(fingerprint)
    if (existing) {
      return { ...obs, duplicate: true }
    }
    seen.set(fingerprint, obs.id)
    return obs
  })
}

export function observationsToReviewRows(
  observations: ScreenshotObservation[]
): ScreenshotReviewRow[] {
  return observations.map((obs) => ({
    id: obs.id,
    date: obs.date,
    biomarker: obs.biomarkerName,
    biomarkerKey: obs.biomarkerKey,
    value: obs.value == null ? "" : String(obs.value),
    unit: obs.unit,
    referenceRange: obs.referenceRange.text,
    status: obs.status,
    confidence: obs.confidence,
    sourceFileName: obs.sourceFileName,
    unknownBiomarker: obs.unknownBiomarker,
    duplicate: obs.duplicate,
    excluded: obs.duplicate ? true : false,
  }))
}

export function buildDiagnostics(
  chunks: ScreenshotTextChunk[],
  rows: ScreenshotReviewRow[]
): ScreenshotImportDiagnostics {
  const active = rows.filter((r) => !r.excluded)
  const confidences = chunks.map((c) => c.confidence)
  const averageOcrConfidence =
    confidences.length === 0
      ? 0
      : confidences.reduce((a, b) => a + b, 0) / confidences.length

  return {
    screensProcessed: chunks.length,
    biomarkersDetected: active.filter((r) => !r.unknownBiomarker).length,
    unknownBiomarkers: active.filter((r) => r.unknownBiomarker).length,
    duplicateResults: rows.filter((r) => r.duplicate).length,
    averageOcrConfidence,
    lowConfidenceCount: active.filter((r) => r.confidence < LOW_OCR_CONFIDENCE)
      .length,
    sourceFiles: chunks.map((c) => c.sourceFileName),
  }
}

/**
 * Rebuild BloodTest domain models from (possibly edited) review rows.
 * Groups by date so the same biomarker on different dates becomes a trend.
 */
export function bloodTestsFromReviewRows(
  rows: ScreenshotReviewRow[],
  options: {
    sourceFileName: string
    provider?: string
    panelName?: string
    source?: string
  }
): BloodTest[] {
  const source = options.source ?? "blood-test-screenshots"
  const provider = options.provider ?? "Screenshot import"
  const panelName = options.panelName ?? "Blood screenshots"

  const active = rows.filter((row) => {
    if (row.excluded) return false
    const value = Number(String(row.value).replace(/,/g, "").trim())
    return Number.isFinite(value) && row.biomarkerKey
  })

  const byDate = new Map<string, ScreenshotReviewRow[]>()
  for (const row of active) {
    const date = row.date && row.date !== "unknown" ? row.date : "unknown"
    const list = byDate.get(date) ?? []
    list.push(row)
    byDate.set(date, list)
  }

  const tests: BloodTest[] = []

  for (const [testDate, dateRows] of byDate) {
    // Within a single date, keep highest-confidence row per biomarker key.
    const bestByKey = new Map<string, ScreenshotReviewRow>()
    for (const row of dateRows) {
      const existing = bestByKey.get(row.biomarkerKey)
      if (!existing || row.confidence > existing.confidence) {
        bestByKey.set(row.biomarkerKey, row)
      }
    }

    const markers: BloodMarker[] = [...bestByKey.values()].map((row) => {
      const value = Number(String(row.value).replace(/,/g, "").trim())
      const range = parseReferenceRangeText(row.referenceRange)
      const status = inferStatus(value, range, row.status)
      const unit = normaliseUnit(row.unit)
      const fingerprint = [source, testDate, row.biomarkerKey, value, unit].join(
        "|"
      )
      return {
        id: crypto.randomUUID(),
        name: row.biomarker,
        key: row.biomarkerKey,
        value,
        unit,
        referenceRange: range,
        status,
        fingerprint,
      }
    })

    if (markers.length === 0) continue

    const fingerprint = [
      source,
      provider,
      testDate,
      markers.map((m) => m.fingerprint).join(","),
    ].join("::")

    tests.push({
      id: crypto.randomUUID(),
      provider,
      panelName,
      testDate,
      markers,
      sourceFileName: options.sourceFileName,
      source,
      fingerprint,
    })
  }

  return tests.sort((a, b) => a.testDate.localeCompare(b.testDate))
}

/** Apply inline review edits: rematch biomarker name → key when name changes. */
export function rematchReviewRow(
  row: ScreenshotReviewRow
): ScreenshotReviewRow {
  const matched = matchBiomarker(row.biomarker)
  if (!matched) {
    return {
      ...row,
      biomarkerKey: slugifyUnknownBiomarker(row.biomarker) || row.biomarkerKey,
      unknownBiomarker: true,
    }
  }
  return {
    ...row,
    biomarker: matched.biomarker.displayName,
    biomarkerKey: matched.biomarker.key,
    unknownBiomarker: false,
    unit: row.unit || matched.biomarker.defaultUnit || "",
  }
}
