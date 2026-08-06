/**
 * Formatting cleanup ONLY — does not alter biomarker names or numeric values.
 * Collapses letter-spaced measurement units and unicode quirks from digital PDFs
 * (e.g. WeasyPrint). Never imports OCR. Never parses biomarkers.
 */

import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import type { StageResult, TextNormalisationDiagnostics } from "../types"
import { logBloodPdfPipeline } from "../log"

/** Unit-like line: short tokens / symbols only (not biomarker names or labels). */
function isSpacedUnitLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length > 48) return false
  if (/^[%]$/.test(trimmed)) return true

  const tokens = trimmed.split(/\s+/)
  if (tokens.length < 2) return false

  const unitToken = /^[A-Za-zΜμµ0-9¹²³⁴⁵⁶⁷⁸⁹⁰.%^×xX\/²³]+$/u
  if (!tokens.every((t) => unitToken.test(t) && t.length <= 4)) return false

  // Reject word tokens ("Free", "PAGE", …). Spaced units are single letters/digits.
  if (tokens.some((t) => /^[A-Za-z]{3,}$/i.test(t))) return false

  if (/\b(NORMAL|HIGH|LOW|CRITICAL|PAGE|OF|SEE|CLINICAL|REVIEW)\b/i.test(trimmed)) {
    return false
  }
  if (/^\d/.test(trimmed)) return false

  const collapsed = tokens.join("")
  // Require a unit shape after collapse — never collapse "PAT I E N T N A M E".
  if (
    !/[/^%×]|X10/i.test(collapsed) &&
    !/^(FL|PG|RATIO|G\/L|U\/L|G\/DL)$/i.test(collapsed)
  ) {
    return false
  }

  return true
}

/** Collapse "N M O L / L" → "NMOL/L", "X 1 0 ^ 9 / L" → "X10^9/L". */
export function collapseSpacedUnitLine(line: string): string {
  const trimmed = line.trim()
  if (!isSpacedUnitLine(trimmed)) return trimmed
  return trimmed.replace(/\s+/g, "")
}

export function normaliseBloodLabText(raw: string): {
  text: string
  unitsCollapsed: number
  numbersCollapsed: number
} {
  let unitsCollapsed = 0
  const numbersCollapsed = 0

  let text = raw
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00a0\u202f\u2007\u2009]/g, " ")
    .replace(/[\u2013\u2014\u2212]/g, "–")

  const lines = text.split("\n")
  const out: string[] = []

  for (const line of lines) {
    let next = line.replace(/[ \t\f\v]+/g, " ").trimEnd()

    if (isSpacedUnitLine(next.trim())) {
      const collapsed = collapseSpacedUnitLine(next)
      if (collapsed !== next.trim()) unitsCollapsed += 1
      next = collapsed
    } else {
      // Value / name lines: collapse runs of spaces only — never join numbers.
      next = next.trim()
    }

    out.push(next)
  }

  text = out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return { text, unitsCollapsed, numbersCollapsed }
}

/**
 * Task 1: persist the exact text the parser will receive (or the raw extract).
 * Prefer cwd/tmp; fall back to /tmp on read-only hosts (Vercel).
 * Also writes a numbered-line dump: line number | length | raw text.
 */
export async function writeParserInputArtifact(
  text: string,
  fileName: string,
  label: "raw_extracted" | "normalised"
): Promise<string | null> {
  const lines = text.split("\n")
  logBloodPdfPipeline("parser_input_capture", {
    label,
    fileName,
    totalCharacters: text.length,
    lineCount: lines.length,
    first1000Chars: text.slice(0, 1000),
    last1000Chars: text.slice(Math.max(0, text.length - 1000)),
  })

  const safe = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80)
  const numbered = lines
    .map((raw, i) => {
      const n = String(i + 1).padStart(4, " ")
      const len = String(raw.length).padStart(4, " ")
      return `${n} | len=${len} | ${JSON.stringify(raw)}`
    })
    .join("\n")

  const bases = [
    join(process.cwd(), "tmp", "blood-pdf-debug"),
    "/tmp",
  ]

  for (const dir of bases) {
    try {
      await mkdir(dir, { recursive: true })
      const path = join(dir, `${label}-${safe}.txt`)
      const numberedPath = join(dir, `${label}-numbered-${safe}.txt`)
      await writeFile(path, text, "utf8")
      await writeFile(numberedPath, numbered, "utf8")
      logBloodPdfPipeline("parser_input_artifact", {
        label,
        path,
        numberedPath,
        byteLength: Buffer.byteLength(text, "utf8"),
        lineCount: lines.length,
      })
      return path
    } catch {
      // try next location
    }
  }

  logBloodPdfPipeline("parser_input_artifact_failed", {
    label,
    fileName,
    totalCharacters: text.length,
  })
  return null
}

/**
 * Stage: Text Normalisation — formatting cleanup before provider/biomarker parse.
 */
export async function runTextNormalisationStage(
  rawText: string,
  fileName: string
): Promise<StageResult<TextNormalisationDiagnostics, { text: string }>> {
  const started = performance.now()

  const rawArtifactPath = await writeParserInputArtifact(
    rawText,
    fileName,
    "raw_extracted"
  )

  const { text, unitsCollapsed, numbersCollapsed } = normaliseBloodLabText(rawText)

  const normalisedArtifactPath = await writeParserInputArtifact(
    text,
    fileName,
    "normalised"
  )

  const diagnostics: TextNormalisationDiagnostics = {
    inputChars: rawText.length,
    outputChars: text.length,
    unitsCollapsed,
    numbersCollapsed,
    first1000Chars: text.slice(0, 1000),
    last1000Chars: text.slice(Math.max(0, text.length - 1000)),
    rawArtifactPath,
    normalisedArtifactPath,
  }

  logBloodPdfPipeline("text_normalisation", {
    inputChars: diagnostics.inputChars,
    outputChars: diagnostics.outputChars,
    unitsCollapsed,
    numbersCollapsed,
    rawArtifactPath,
    normalisedArtifactPath,
  })

  return {
    stage: "text_normalisation",
    status: "ok",
    durationMs: Math.round(performance.now() - started),
    diagnostics,
    data: { text },
  }
}
