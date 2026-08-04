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
  /^(G\/L|G\/DL|U\/L|MMOL\/L|MMOL\/MOL|NMOL\/L|PMOL\/L|MU\/L|NG\/ML|MG\/L|ML\/MIN\/1\.73M2|ML\/MIN\/1\.73M²|RATIO|%|PG|FL|X10\^?\d*\/L|X10⁴⁹\/L|X10⁴¹²\/L|×10[⁹¹²]+\/L)$/i

function looksLikeUnit(line: string): boolean {
  const cleaned = line.trim().replace(/\s+/g, "")
  return (
    UNIT_RE.test(cleaned) ||
    UNIT_RE.test(line.trim()) ||
    /^X10/i.test(cleaned)
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

/** Common OCR / naming normalisations for Numan biomarker identifiers. */
const NAME_ALIASES: Record<string, string> = {
  hbaic: "HbA1c",
  "hba1c": "HbA1c",
  haemoglobin: "Haemoglobin",
  hemoglobin: "Haemoglobin",
  "non hdl cholesterol": "Non HDL Cholesterol",
  "cholesterol:hdl ratio": "Cholesterol:HDL Ratio",
  "free t4": "Free T4",
  "free testosterone": "Free Testosterone",
  /** Numan (and many labs) label total T as "Total Testosterone". */
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
  /** Markers found on the page but missing a reliable numeric value. */
  manualEntryRequired: BloodManualEntryMarker[]
  clinicalReview?: string
  warnings: string[]
  rawTextLength: number
}

function slugifyMarker(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
}

function normaliseUnit(unit: string): string {
  const u = unit.trim().toUpperCase()
  if (/X10.?49\/L|X10\^?9\/L|×10⁹\/L/i.test(u)) return "×10⁹/L"
  if (/X10.?412\/L|X10\^?12\/L|×10¹²\/L/i.test(u)) return "×10¹²/L"
  if (/ML\/MIN\/1\.73M/i.test(u)) return "mL/min/1.73m²"
  if (u === "MMOL/L") return "mmol/L"
  if (u === "MMOL/MOL") return "mmol/mol"
  if (u === "NMOL/L") return "nmol/L"
  if (u === "PMOL/L") return "pmol/L"
  if (u === "MU/L") return "mU/L"
  if (u === "NG/ML") return "ng/mL"
  if (u === "MG/L") return "mg/L"
  if (u === "G/L") return "g/L"
  if (u === "G/DL") return "g/dL"
  if (u === "U/L") return "U/L"
  if (u === "PG") return "pg"
  if (u === "FL") return "fL"
  if (u === "RATIO") return "ratio"
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

/**
 * Parse a Numan blood-test PDF text dump (native text or OCR) into structured markers.
 */
export function parseNumanBloodText(rawText: string): BloodMarkerParseResult {
  const warnings: string[] = []
  const text = rawText.replace(/\u0000/g, "").replace(/\r/g, "")
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)

  const header = extractHeader(text, lines, warnings)
  const clinicalReview = extractClinicalReview(text)
  const { markers, manualEntryRequired } = extractMarkers(lines, warnings)
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
  }
}

/**
 * When OCR drops Non HDL Cholesterol but Cholesterol + HDL are present,
 * derive Non-HDL = Cholesterol − HDL (standard lipid identity).
 */
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
  // Drop the earlier OCR-failure warning for this marker if present
  const idx = warnings.findIndex((w) =>
    w.includes("Non HDL Cholesterol") && w.includes("garbled")
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
    const dates = [...text.matchAll(
      /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/gi
    )].map((m) => m[1])
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
      return "nmol/L"
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

function captureManualEntry(
  line: string,
  nextLine: string | undefined,
  knownName: string
): BloodManualEntryMarker {
  const canonical = normaliseName(knownName)
  const flagMatch = line.match(FLAG_RE)
  const status: BloodMarkerStatus = flagMatch
    ? parseStatus(flagMatch[1] ?? "")
    : "unknown"

  const beforeFlag =
    flagMatch && flagMatch.index !== undefined
      ? line.slice(0, flagMatch.index).trim()
      : line.trim()

  const rangeMatch = beforeFlag.match(
    /((?:\d+(?:\.\d+)?\s*[-–—]\s*\d+(?:\.\d+)?)|(?:[<>]\s*\d+(?:\.\d+)?)|(?:[-–—]))\s*$/
  )

  let unit = ""
  if (nextLine && looksLikeUnit(nextLine)) {
    unit = normaliseUnit(nextLine)
  }
  if (!unit) unit = defaultUnitForMarker(canonical)

  return {
    name: canonical,
    key: slugifyMarker(canonical),
    unit,
    referenceRange: rangeMatch
      ? parseReferenceRange(rangeMatch[1] ?? "")
      : { text: "—" },
    status,
    reason: `Could not read a reliable value for ${canonical} (OCR may have garbled the number).`,
  }
}

function extractMarkers(
  lines: string[],
  warnings: string[]
): {
  markers: Omit<BloodMarker, "id" | "fingerprint">[]
  manualEntryRequired: BloodManualEntryMarker[]
} {
  const markers: Omit<BloodMarker, "id" | "fingerprint">[] = []
  const manualEntryRequired: BloodManualEntryMarker[] = []
  const seen = new Set<string>()
  const failedKnown = new Set<string>()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^Identifier\b/i.test(line)) continue
    if (/^Page \d+/i.test(line)) continue
    if (/^Clinical review$/i.test(line)) continue
    if (/^PATIENT NAME\b/i.test(line)) continue
    if (/^TEST TAKEN\b/i.test(line)) continue

    const knownOnLine = matchKnownMarker(line)
    const parsed = parseMarkerLine(line, lines[i + 1])
    if (!parsed) {
      if (
        knownOnLine &&
        FLAG_RE.test(line) &&
        !failedKnown.has(knownOnLine)
      ) {
        failedKnown.add(knownOnLine)
        const entry = captureManualEntry(line, lines[i + 1], knownOnLine)
        if (!seen.has(entry.key) && !manualEntryRequired.some((m) => m.key === entry.key)) {
          manualEntryRequired.push(entry)
          warnings.push(entry.reason)
        }
        if (looksLikeUnit(lines[i + 1] ?? "")) {
          i += 1
        }
      }
      continue
    }

    const key = slugifyMarker(parsed.name)
    if (seen.has(key)) continue
    seen.add(key)

    if (looksLikeUnit(lines[i + 1] ?? "")) {
      i += 1
    }

    markers.push({
      name: parsed.name,
      key,
      value: parsed.value,
      unit: parsed.unit,
      referenceRange: parsed.referenceRange,
      status: parsed.status,
    })
  }

  if (markers.length > 0 && markers.length < 5) {
    warnings.push(
      `Only ${markers.length} biomarkers were extracted — OCR may have missed rows.`
    )
  }

  // Drop markers that also appear in manual entry (prefer asking the user)
  const manualKeys = new Set(manualEntryRequired.map((m) => m.key))
  const filteredMarkers = markers.filter((m) => !manualKeys.has(m.key))

  return { markers: filteredMarkers, manualEntryRequired }
}

function matchKnownMarker(line: string): string | null {
  const lower = line.toLowerCase()
  // Prefer longer names first (Free / Total Testosterone before Testosterone)
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

/** Recover a value when OCR mangled the token (light noise only). */
function recoverOcrNumber(token: string): number | null {
  const trimmed = token.trim()
  if (!trimmed) return null

  // Prefer an explicit decimal number embedded in the token
  const decimal = trimmed.match(/\d+\.\d+/)
  if (decimal) {
    const value = Number(decimal[0])
    return Number.isFinite(value) ? value : null
  }

  // Reject letter-prefixed garbage like "W183" / "hf)" / "x6}"
  if (/[A-Za-z]/.test(trimmed)) return null

  const digits = trimmed.replace(/[^\d.]/g, "")
  if (!digits || !/^\d+(?:\.\d+)?$/.test(digits)) return null
  const value = Number(digits)
  return Number.isFinite(value) ? value : null
}

function parseMarkerLine(
  line: string,
  nextLine?: string
): {
  name: string
  value: number
  unit: string
  referenceRange: BloodReferenceRange
  status: BloodMarkerStatus
} | null {
  const flagMatch = line.match(FLAG_RE)
  if (!flagMatch || flagMatch.index === undefined) return null

  // Ignore narrative mentions — table rows put the flag at/near the end
  const afterFlag = line.slice(flagMatch.index + flagMatch[0].length).trim()
  if (afterFlag.length > 8) return null

  const status = parseStatus(flagMatch[1])
  const beforeFlag = line.slice(0, flagMatch.index).trim()

  const cleaned = beforeFlag
    .replace(/[©®@●•·]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const rangeMatch = cleaned.match(
    /((?:\d+(?:\.\d+)?\s*[-–—]\s*\d+(?:\.\d+)?)|(?:[<>]\s*\d+(?:\.\d+)?)|(?:[-–—]))\s*$/
  )
  if (!rangeMatch || rangeMatch.index === undefined) return null

  const rangeText = rangeMatch[1]?.trim() ?? ""
  const beforeRange = cleaned.slice(0, rangeMatch.index).trim()

  const known = matchKnownMarker(beforeRange)
  let name: string
  let value: number

  const cleanValueMatch = beforeRange.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*$/)

  if (cleanValueMatch) {
    name = normaliseName(known ?? cleanValueMatch[1] ?? "")
    value = Number(cleanValueMatch[2])
  } else if (known) {
    const remainder = beforeRange.slice(known.length).trim()
    const token = remainder.split(/\s+/)[0] ?? ""
    const recovered = recoverOcrNumber(token)
    if (recovered === null) return null
    name = normaliseName(known)
    value = recovered
  } else {
    return null
  }

  if (!Number.isFinite(value)) return null
  if (name.length < 2 || name.length > 48) return null
  if (/^(observation|normal|value|flags|identifier)$/i.test(name)) return null

  let unit = ""
  if (nextLine && looksLikeUnit(nextLine)) {
    unit = normaliseUnit(nextLine)
  }

  return {
    name,
    value,
    unit,
    referenceRange: parseReferenceRange(rangeText),
    status,
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
