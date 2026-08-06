/**
 * Structure discovered from WeasyPrint Numan extract (do not invent):
 *
 *   Line 105: Testosterone
 *   Line 106: N M O L / L          ← unit alone (letter-spaced)
 *   Line 107: 11.3 15.0–31.0 LOW  ← value + range + flag together
 *   Line 108: Free Testosterone   ← next biomarker (no blank separator)
 *
 * Rows are 3 lines. Units are on their own line. Flags are NOT alone —
 * they share the value line. Reference ranges share the value line.
 * No blank lines between biomarker rows.
 */

import type {
  BloodMarker,
  BloodMarkerStatus,
  BloodReferenceRange,
  BloodTest,
} from "@/lib/domain/blood"
import type { BloodManualEntryMarker } from "./manual-entry"

const FLAG_RE =
  /\b(NORMAL|HIGH|LOW|CRITICAL|SEE\s+CLINICAL\s+REVIEW)\b/i

const UNIT_RE =
  /^(G\/L|G\/DL|U\/L|MMOL\/L|MMOL\/MOL|UMOL\/L|NMOL\/L|PMOL\/L|MU\/L|NG\/ML|MG\/L|UG\/L|ML\/MIN\/1\.73M2|ML\/MIN\/1\.73M²|RATIO|%|PG|FL|X10\^?\d*\/L|X10⁴⁹\/L|X10⁴¹²\/L|×10[⁹¹²]+\/L)$/i

/** Instrumentation for a candidate biomarker row. */
export type BiomarkerRowAttempt = {
  matched: boolean
  reason?: string
  regexAttempted: string
  line: string
  markerName?: string
  tokensConsumed?: string[]
  constructedRow?: {
    biomarker: string
    value: number | null
    unit: string
    referenceRange: string
    flag: string
  }
}

export type BiomarkerParseInstrumentation = {
  candidateRows: number
  matchedRows: number
  ignoredRows: number
  rowAttempts: BiomarkerRowAttempt[]
}

function canonicalizeUnitToken(line: string): string {
  return line
    .trim()
    .replace(/\s+/g, "")
    .replace(/[Μμµ](?=G\/L)/gi, "U")
    .replace(/[Μμµ](?=MOL)/gi, "U")
    .replace(/[Μμµ]/g, "U")
}

function looksLikeUnit(line: string): boolean {
  const cleaned = canonicalizeUnitToken(line)
  return (
    UNIT_RE.test(cleaned) ||
    UNIT_RE.test(line.trim()) ||
    /^X10/i.test(cleaned) ||
    cleaned === "%"
  )
}

const KNOWN_MARKERS = [
  "Albumin",
  "ALP",
  "ALT",
  "AST",
  "Basophils",
  "Cholesterol",
  "Cholesterol:HDL Ratio",
  "Creatinine",
  "eGFR",
  "Eosinophils",
  "Estradiol",
  "FAI",
  "Ferritin",
  "Free T4",
  "Free Testosterone",
  "FSH",
  "GGT",
  "Globulin",
  "Haemoglobin",
  "HbA1c",
  "HCT",
  "HDL",
  "LDL",
  "LH",
  "Lymphocytes",
  "MCH",
  "MCHC",
  "MCV",
  "Monocytes",
  "Neutrophils",
  "Non HDL Cholesterol",
  "Platelets",
  "Prolactin",
  "PSA",
  "RBC",
  "SHBG",
  "Testosterone",
  "Total Testosterone",
  "Total Bilirubin",
  "Total Protein",
  "Triglycerides",
  "TSH",
  "Urea",
  "WCC",
] as const

const NAME_ALIASES: Record<string, string> = {
  hbaic: "HbA1c",
  hba1c: "HbA1c",
  haemoglobin: "Haemoglobin",
  hemoglobin: "Haemoglobin",
  "non hdl cholesterol": "Non HDL Cholesterol",
  "cholesterol:hdl ratio": "Cholesterol:HDL Ratio",
  "free t4": "Free T4",
  "free testosterone": "Free Testosterone",
  "total testosterone": "Testosterone",
  "serum testosterone": "Testosterone",
  testosterone: "Testosterone",
  "total bilirubin": "Total Bilirubin",
  "total protein": "Total Protein",
  wcc: "WCC",
  rbc: "RBC",
  egfr: "eGFR",
  alp: "ALP",
  alt: "ALT",
  ast: "AST",
  fai: "FAI",
  fsh: "FSH",
  ggt: "GGT",
  hct: "HCT",
  hdl: "HDL",
  ldl: "LDL",
  lh: "LH",
  mch: "MCH",
  mchc: "MCHC",
  mcv: "MCV",
  psa: "PSA",
  shbg: "SHBG",
  tsh: "TSH",
}

export interface ParsedBloodHeader {
  provider: string
  panelName: string
  patientName?: string
  sex?: string
  testDate?: string
  exportedAt?: string
}

export interface BloodMarkerParseResult {
  header: ParsedBloodHeader
  markers: Omit<BloodMarker, "id" | "fingerprint">[]
  manualEntryRequired: BloodManualEntryMarker[]
  clinicalReview?: string
  warnings: string[]
  rawTextLength: number
  instrumentation: BiomarkerParseInstrumentation
}

function slugifyMarker(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
}

function normaliseUnit(unit: string): string {
  const u = canonicalizeUnitToken(unit).toUpperCase()
  if (/X10.?49\/L|X10\^?9\/L|×10⁹\/L/i.test(u)) return "×10⁹/L"
  if (/X10.?412\/L|X10\^?12\/L|×10¹²\/L/i.test(u)) return "×10¹²/L"
  if (/ML\/MIN\/1\.73M/i.test(u)) return "mL/min/1.73m²"
  if (u === "MMOL/L") return "mmol/L"
  if (u === "MMOL/MOL") return "mmol/mol"
  if (u === "UMOL/L") return "µmol/L"
  if (u === "NMOL/L") return "nmol/L"
  if (u === "PMOL/L") return "pmol/L"
  if (u === "MU/L") return "mU/L"
  if (u === "NG/ML") return "ng/mL"
  if (u === "UG/L") return "µg/L"
  if (u === "MG/L") return "mg/L"
  if (u === "G/L") return "g/L"
  if (u === "G/DL") return "g/dL"
  if (u === "U/L") return "U/L"
  if (u === "PG") return "pg"
  if (u === "FL") return "fL"
  if (u === "RATIO") return "ratio"
  if (u === "%") return "%"
  return unit.trim()
}

function normaliseName(raw: string): string {
  const cleaned = raw
    .replace(/[©®@●•·]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  const alias = NAME_ALIASES[cleaned.toLowerCase()]
  return alias ?? cleaned
}

function parseStatus(raw: string): BloodMarkerStatus {
  const text = raw.replace(/\s+/g, " ").trim().toUpperCase()
  if (text.includes("SEE CLINICAL")) return "review"
  if (text === "NORMAL") return "normal"
  if (text === "HIGH") return "high"
  if (text === "LOW") return "low"
  if (text === "CRITICAL") return "critical"
  return "unknown"
}

export function parseReferenceRange(text: string): BloodReferenceRange {
  const cleaned = text.replace(/\s+/g, "").replace(/–|—/g, "-")
  if (!cleaned || cleaned === "-" || cleaned === "—") {
    return { text: "—" }
  }

  const between = cleaned.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/)
  if (between) {
    return {
      text: `${between[1]}-${between[2]}`,
      low: Number(between[1]),
      high: Number(between[2]),
    }
  }

  const lt = cleaned.match(/^<(\d+(?:\.\d+)?)$/)
  if (lt) {
    return { text: `<${lt[1]}`, high: Number(lt[1]) }
  }

  const gt = cleaned.match(/^>(\d+(?:\.\d+)?)$/)
  if (gt) {
    return { text: `>${gt[1]}`, low: Number(gt[1]) }
  }

  return { text }
}

function parseDateToIso(raw: string): string | undefined {
  const match = raw.match(
    /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i
  )
  if (!match) return undefined
  const day = Number(match[1])
  const monthName = match[2].toLowerCase()
  const year = Number(match[3])
  const months: Record<string, number> = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  }
  const month = months[monthName]
  if (month === undefined) return undefined
  const date = new Date(Date.UTC(year, month, day))
  return date.toISOString().slice(0, 10)
}

export function parseNumanBloodText(rawText: string): BloodMarkerParseResult {
  const warnings: string[] = []
  const text = rawText.replace(/\u0000/g, "").replace(/\r/g, "")
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)

  const header = extractHeader(text, lines, warnings)
  const clinicalReview = extractClinicalReview(text)
  const { markers, manualEntryRequired, instrumentation } = extractMarkers(
    lines,
    warnings
  )
  recoverDerivedMarkers(markers, warnings)

  if (markers.length === 0 && manualEntryRequired.length === 0) {
    warnings.push("No biomarker rows could be parsed from the PDF text.")
  }

  return {
    header,
    markers,
    manualEntryRequired,
    clinicalReview,
    warnings,
    rawTextLength: text.length,
    instrumentation,
  }
}

function recoverDerivedMarkers(
  markers: Omit<BloodMarker, "id" | "fingerprint">[],
  warnings: string[]
): void {
  const byKey = new Map(markers.map((m) => [m.key, m]))
  if (byKey.has("non_hdl_cholesterol")) return

  const cholesterol = byKey.get("cholesterol")
  const hdl = byKey.get("hdl")
  if (!cholesterol || !hdl) return
  if (cholesterol.unit && hdl.unit && cholesterol.unit !== hdl.unit) return

  const value = Number((cholesterol.value - hdl.value).toFixed(2))
  if (!Number.isFinite(value) || value < 0) return

  markers.push({
    name: "Non HDL Cholesterol",
    key: "non_hdl_cholesterol",
    value,
    unit: cholesterol.unit || hdl.unit || "mmol/L",
    referenceRange: { text: "<2.6", high: 2.6 },
    status: value >= 2.6 ? "high" : "normal",
  })
  warnings.push(
    "Non HDL Cholesterol was derived from Cholesterol − HDL because OCR could not read the value."
  )
  const idx = warnings.findIndex(
    (w) => w.includes("Non HDL Cholesterol") && w.includes("garbled")
  )
  if (idx >= 0) warnings.splice(idx, 1)
}

function extractHeader(
  text: string,
  lines: string[],
  warnings: string[]
): ParsedBloodHeader {
  const provider = /numan/i.test(text) ? "Numan" : "Unknown"

  let panelName = "Blood Test"
  const panelLine = lines.find((line) =>
    /blood test|venous|panel|results/i.test(line)
  )
  if (panelLine) {
    panelName = panelLine
      .replace(/\brman\b/gi, "")
      .replace(/\bnuman\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()
  }

  let patientName: string | undefined
  let sex: string | undefined
  let testDate: string | undefined
  let exportedAt: string | undefined

  const nameLine = lines.find((line) =>
    /^[A-Z][a-z]+\s+[A-Z][a-z]+\s+(Male|Female)\b/i.test(line)
  )
  if (nameLine) {
    const parts = nameLine.match(
      /^([A-Za-z]+(?:\s+[A-Za-z]+)+)\s+(Male|Female)\s+(\d{1,2}\s+\w+\s+\d{4})\s+(\d{1,2}\s+\w+\s+\d{4})/i
    )
    if (parts) {
      patientName = parts[1]
      sex = parts[2]
      testDate = parseDateToIso(parts[3] ?? "")
      exportedAt = parseDateToIso(parts[4] ?? "")
    }
  }

  if (!testDate) {
    const dates = [
      ...text.matchAll(
        /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/gi
      ),
    ].map((m) => m[1])
    if (dates[0]) testDate = parseDateToIso(dates[0])
    if (dates[1]) exportedAt = parseDateToIso(dates[1])
  }

  if (!testDate) {
    warnings.push("Could not determine test date from the PDF header.")
  }

  return {
    provider,
    panelName: panelName || "Blood Test",
    patientName,
    sex,
    testDate,
    exportedAt,
  }
}

function extractClinicalReview(text: string): string | undefined {
  const start = text.search(/Clinical review/i)
  if (start < 0) return undefined
  const from = text.slice(start)
  const end = from.search(
    /Identifier\s+Observation|Learn more about each biomarker|Best wishes/i
  )
  const body = (end > 0 ? from.slice(0, end) : from.slice(0, 4000))
    .replace(/^Clinical review\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
  return body || undefined
}

function defaultUnitForMarker(name: string): string {
  switch (name) {
    case "Testosterone":
    case "Free Testosterone":
      return "nmol/L"
    case "HbA1c":
      return "mmol/mol"
    case "Oestradiol":
    case "Estradiol":
      return "pmol/L"
    case "Cholesterol":
    case "LDL":
    case "HDL":
    case "Triglycerides":
    case "Non HDL Cholesterol":
      return "mmol/L"
    case "SHBG":
      return "nmol/L"
    case "TSH":
      return "mU/L"
    default:
      return ""
  }
}

function isSkipLine(line: string): boolean {
  if (/^Identifier\b/i.test(line)) return true
  if (/^Page \d+/i.test(line)) return true
  if (/^Clinical review$/i.test(line)) return true
  if (/^PATIENT NAME\b/i.test(line)) return true
  if (/^TEST TAKEN\b/i.test(line)) return true
  return false
}

function isSectionBoundary(line: string): boolean {
  return (
    /^Identifier\b/i.test(line) ||
    /^Page \d+/i.test(line) ||
    /^Clinical review$/i.test(line)
  )
}

function matchKnownMarker(line: string): string | null {
  const lower = line.toLowerCase()
  const sorted = [...KNOWN_MARKERS].sort((a, b) => b.length - a.length)
  for (const name of sorted) {
    if (lower.startsWith(name.toLowerCase())) {
      const boundary = line[name.length]
      if (!boundary || /[\s\d]/.test(boundary) || /[^A-Za-z]/.test(boundary)) {
        return name
      }
    }
  }
  return null
}

/** Line is exactly a known biomarker name (WeasyPrint row start). */
function isNameOnlyMarkerLine(line: string, known: string): boolean {
  return line.slice(known.length).trim().length === 0
}

function recoverOcrNumber(token: string): number | null {
  const trimmed = token.trim()
  if (!trimmed) return null
  const decimal = trimmed.match(/\d+\.\d+/)
  if (decimal) {
    const value = Number(decimal[0])
    return Number.isFinite(value) ? value : null
  }
  if (/[A-Za-z]/.test(trimmed)) return null
  const digits = trimmed.replace(/[^\d.]/g, "")
  if (!digits || !/^\d+(?:\.\d+)?$/.test(digits)) return null
  const value = Number(digits)
  return Number.isFinite(value) ? value : null
}

type ConstructedFields = {
  value: number
  unit: string
  referenceRange: BloodReferenceRange
  status: BloodMarkerStatus
  flagRaw: string
}

/**
 * Build fields from tokens between this biomarker and the next.
 * Observed WeasyPrint window: ["NMOL/L", "11.3 15.0–31.0 LOW"]
 * Observed OCR window: remainder of same line + optional unit line.
 */
function constructFromTokens(
  biomarker: string,
  tokens: string[]
): { ok: true; fields: ConstructedFields } | { ok: false; reason: string } {
  let unit = ""
  const contentParts: string[] = []

  for (const token of tokens) {
    if (looksLikeUnit(token)) {
      if (!unit) unit = normaliseUnit(token)
      continue
    }
    contentParts.push(token)
  }

  const content = contentParts.join(" ").replace(/\s+/g, " ").trim()
  if (!content) {
    return { ok: false, reason: "no value/flag tokens after biomarker name" }
  }

  const flagMatch = content.match(FLAG_RE)
  if (!flagMatch || flagMatch.index === undefined) {
    return { ok: false, reason: "flag not found in token window" }
  }

  const afterFlag = content.slice(flagMatch.index + flagMatch[0].length).trim()
  if (afterFlag.length > 8) {
    return { ok: false, reason: "flag not at end of token window (narrative)" }
  }

  const flagRaw = flagMatch[1] ?? ""
  const status = parseStatus(flagRaw)
  const beforeFlag = content.slice(0, flagMatch.index).trim()

  const rangeMatch = beforeFlag.match(
    /((?:\d+(?:\.\d+)?\s*[-–—]\s*\d+(?:\.\d+)?)|(?:[<>]\s*\d+(?:\.\d+)?)|(?:[-–—]))\s*$/
  )
  if (!rangeMatch || rangeMatch.index === undefined) {
    return { ok: false, reason: "reference range not found in token window" }
  }

  const rangeText = rangeMatch[1]?.trim() ?? ""
  const beforeRange = beforeFlag.slice(0, rangeMatch.index).trim()

  // Strip leading biomarker name if still present (single-line OCR rows).
  let valueSource = beforeRange
  if (beforeRange.toLowerCase().startsWith(biomarker.toLowerCase())) {
    const boundary = beforeRange[biomarker.length]
    if (!boundary || /[\s\d]/.test(boundary) || /[^A-Za-z]/.test(boundary)) {
      valueSource = beforeRange.slice(biomarker.length).trim()
    }
  }

  const cleanValueMatch = valueSource.match(/^(\d+(?:\.\d+)?)\s*$/)
  let value: number | null = null
  if (cleanValueMatch) {
    value = Number(cleanValueMatch[1])
  } else {
    const token = valueSource.split(/\s+/)[0] ?? ""
    value = recoverOcrNumber(token)
  }

  if (value === null || !Number.isFinite(value)) {
    return { ok: false, reason: "numeric value not found in token window" }
  }

  if (!unit) unit = defaultUnitForMarker(biomarker)

  return {
    ok: true,
    fields: {
      value,
      unit,
      referenceRange: parseReferenceRange(rangeText),
      status,
      flagRaw,
    },
  }
}

/**
 * Collect lines after a name-only biomarker until the next biomarker name
 * or a section boundary. This is the semantic row — not one-line regex.
 */
function collectTokenWindow(
  lines: string[],
  startIndex: number
): { tokens: string[]; endExclusive: number } {
  const tokens: string[] = []
  let j = startIndex + 1
  while (j < lines.length) {
    const line = lines[j]
    if (isSectionBoundary(line)) break
    const nextKnown = matchKnownMarker(line)
    if (nextKnown && isNameOnlyMarkerLine(line, nextKnown)) break
    tokens.push(line)
    j += 1
  }
  return { tokens, endExclusive: j }
}

function extractMarkers(
  lines: string[],
  warnings: string[]
): {
  markers: Omit<BloodMarker, "id" | "fingerprint">[]
  manualEntryRequired: BloodManualEntryMarker[]
  instrumentation: BiomarkerParseInstrumentation
} {
  const markers: Omit<BloodMarker, "id" | "fingerprint">[] = []
  const manualEntryRequired: BloodManualEntryMarker[] = []
  const seen = new Set<string>()
  const rowAttempts: BiomarkerRowAttempt[] = []
  let candidateRows = 0
  let matchedRows = 0
  let ignoredRows = 0

  for (let i = 0; i < lines.length; ) {
    const line = lines[i]

    if (isSkipLine(line)) {
      ignoredRows += 1
      i += 1
      continue
    }

    const knownOnLine = matchKnownMarker(line)

    // Narrative / non-marker lines
    if (!knownOnLine) {
      ignoredRows += 1
      i += 1
      continue
    }

    // Title lines like "Testosterone Venous Blood Test…" — not a table row.
    if (!isNameOnlyMarkerLine(line, knownOnLine) && !FLAG_RE.test(line)) {
      ignoredRows += 1
      i += 1
      continue
    }

    candidateRows += 1
    const biomarker = normaliseName(knownOnLine)

    let tokens: string[]
    let endExclusive: number
    let strategy: string

    if (isNameOnlyMarkerLine(line, knownOnLine)) {
      // WeasyPrint / flattened digital PDF: name, then tokens until next name.
      const window = collectTokenWindow(lines, i)
      tokens = window.tokens
      endExclusive = window.endExclusive
      strategy = "semantic_window:name→next_biomarker"
    } else {
      // Classic single-line OCR: Name Value Range FLAG [+ unit on next line]
      tokens = [line]
      endExclusive = i + 1
      if (looksLikeUnit(lines[i + 1] ?? "")) {
        tokens.push(lines[i + 1]!)
        endExclusive = i + 2
      }
      strategy = "semantic_window:single_line[+unit]"
    }

    const constructed = constructFromTokens(biomarker, tokens)
    const constructedRow = {
      biomarker,
      value: constructed.ok ? constructed.fields.value : null,
      unit: constructed.ok
        ? constructed.fields.unit
        : tokens.find((t) => looksLikeUnit(t))
          ? normaliseUnit(tokens.find((t) => looksLikeUnit(t))!)
          : defaultUnitForMarker(biomarker),
      referenceRange: constructed.ok
        ? constructed.fields.referenceRange.text
        : "—",
      flag: constructed.ok ? constructed.fields.flagRaw : "",
    }

    if (!constructed.ok) {
      // Garbled value with flag still present → manual entry
      if (FLAG_RE.test(tokens.join(" "))) {
        const key = slugifyMarker(biomarker)
        if (!seen.has(key) && !manualEntryRequired.some((m) => m.key === key)) {
          const entry: BloodManualEntryMarker = {
            name: biomarker,
            key,
            unit: constructedRow.unit,
            referenceRange: { text: constructedRow.referenceRange },
            status: "unknown",
            reason: `Could not read a reliable value for ${biomarker} (OCR may have garbled the number).`,
          }
          manualEntryRequired.push(entry)
          warnings.push(entry.reason)
        }
      }
      rowAttempts.push({
        matched: false,
        reason: constructed.reason,
        regexAttempted: strategy,
        line: [line, ...tokens].join(" | "),
        markerName: biomarker,
        tokensConsumed: tokens,
        constructedRow,
      })
      i = Math.max(endExclusive, i + 1)
      continue
    }

    const key = slugifyMarker(biomarker)
    if (seen.has(key)) {
      rowAttempts.push({
        matched: false,
        reason: "duplicate marker key skipped",
        regexAttempted: strategy,
        line: [line, ...tokens].join(" | "),
        markerName: biomarker,
        tokensConsumed: tokens,
        constructedRow,
      })
      i = Math.max(endExclusive, i + 1)
      continue
    }
    seen.add(key)
    matchedRows += 1

    rowAttempts.push({
      matched: true,
      regexAttempted: strategy,
      line: [line, ...tokens].join(" | "),
      markerName: biomarker,
      tokensConsumed: tokens,
      constructedRow,
    })

    markers.push({
      name: biomarker,
      key,
      value: constructed.fields.value,
      unit: constructed.fields.unit,
      referenceRange: constructed.fields.referenceRange,
      status: constructed.fields.status,
    })

    i = Math.max(endExclusive, i + 1)
  }

  if (markers.length > 0 && markers.length < 5) {
    warnings.push(
      `Only ${markers.length} biomarkers were extracted — OCR may have missed rows.`
    )
  }

  const manualKeys = new Set(manualEntryRequired.map((m) => m.key))
  const filteredMarkers = markers.filter((m) => !manualKeys.has(m.key))

  return {
    markers: filteredMarkers,
    manualEntryRequired,
    instrumentation: {
      candidateRows,
      matchedRows,
      ignoredRows,
      rowAttempts,
    },
  }
}

export function buildBloodTest(
  parsed: BloodMarkerParseResult,
  fileName: string,
  source = "blood-test"
): BloodTest {
  const testDate = parsed.header.testDate ?? "unknown"
  const markers: BloodMarker[] = parsed.markers.map((marker) => {
    const fingerprint = [
      source,
      testDate,
      marker.key,
      marker.value,
      marker.unit,
    ].join("|")
    return {
      ...marker,
      id: crypto.randomUUID(),
      fingerprint,
    }
  })

  const fingerprint = [
    source,
    parsed.header.provider,
    testDate,
    markers.map((m) => m.fingerprint).join(","),
  ].join("::")

  return {
    id: crypto.randomUUID(),
    provider: parsed.header.provider,
    panelName: parsed.header.panelName,
    testDate,
    exportedAt: parsed.header.exportedAt,
    patientName: parsed.header.patientName,
    sex: parsed.header.sex,
    markers,
    clinicalReview: parsed.clinicalReview,
    sourceFileName: fileName,
    source,
    fingerprint,
  }
}
