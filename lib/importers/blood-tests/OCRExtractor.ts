import "server-only"

/**
 * Replaceable OCR layer for screenshot blood-test imports.
 * Future AI extraction can implement the same OCRExtractor interface
 * without changing ScreenshotBloodTestImporter architecture.
 */

import { execFile } from "node:child_process"
import { mkdtemp, writeFile, rm, readFile, access } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, extname } from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export interface OCRExtractInput {
  bytes: Uint8Array
  fileName: string
  mimeType?: string
}

export interface OCRExtractResult {
  text: string
  /** Mean word confidence in 0–1. */
  confidence: number
  warnings: string[]
  method: "tesseract-cli" | "none"
  sourceFileName: string
}

/**
 * Pluggable text extractor. Swap implementations for AI later.
 */
export interface OCRExtractor {
  extract(input: OCRExtractInput): Promise<OCRExtractResult>
}

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".heic",
  ".heif",
  ".webp",
  ".tif",
  ".tiff",
  ".bmp",
])

function extensionOf(fileName: string): string {
  const ext = extname(fileName).toLowerCase()
  return ext || ""
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Convert HEIC/HEIF to PNG when possible (macOS `sips`, or ImageMagick).
 */
async function ensureRasterImage(
  dir: string,
  fileName: string,
  bytes: Uint8Array
): Promise<{ path: string; warnings: string[] }> {
  const warnings: string[] = []
  const ext = extensionOf(fileName)
  const inputPath = join(dir, `input${ext || ".bin"}`)
  await writeFile(inputPath, bytes)

  if (ext !== ".heic" && ext !== ".heif") {
    return { path: inputPath, warnings }
  }

  const pngPath = join(dir, "converted.png")

  try {
    await execFileAsync("sips", ["-s", "format", "png", inputPath, "--out", pngPath], {
      maxBuffer: 20 * 1024 * 1024,
    })
    if (await pathExists(pngPath)) {
      warnings.push("Converted HEIC to PNG via sips for OCR.")
      return { path: pngPath, warnings }
    }
  } catch {
    // try ImageMagick next
  }

  try {
    await execFileAsync("magick", [inputPath, pngPath], {
      maxBuffer: 20 * 1024 * 1024,
    })
    if (await pathExists(pngPath)) {
      warnings.push("Converted HEIC to PNG via ImageMagick for OCR.")
      return { path: pngPath, warnings }
    }
  } catch {
    // fall through
  }

  warnings.push(
    "HEIC conversion unavailable on this server — OCR may fail. Prefer PNG or JPEG screenshots."
  )
  return { path: inputPath, warnings }
}

async function ocrWithCli(imagePath: string): Promise<{
  text: string
  confidence: number
}> {
  // TSV includes per-word confidence in column 11 (0-based index 10).
  const { stdout } = await execFileAsync(
    "tesseract",
    [imagePath, "stdout", "-l", "eng", "--psm", "6", "tsv"],
    { maxBuffer: 20 * 1024 * 1024 }
  )

  const lines = stdout.split(/\r?\n/).slice(1)
  const confidences: number[] = []
  const words: string[] = []
  let lastBlock = ""
  let lastLine = ""

  for (const row of lines) {
    if (!row.trim()) continue
    const cols = row.split("\t")
    if (cols.length < 12) continue
    const level = cols[0]
    if (level !== "5") continue // word level
    const conf = Number(cols[10])
    const text = cols[11] ?? ""
    if (!text || text === "-") continue
    if (Number.isFinite(conf) && conf >= 0) confidences.push(conf)
    const block = cols[2] ?? ""
    const lineNum = cols[4] ?? ""
    if (lastLine && (block !== lastBlock || lineNum !== lastLine)) {
      words.push("\n")
    } else if (words.length > 0 && words[words.length - 1] !== "\n") {
      words.push(" ")
    }
    words.push(text)
    lastBlock = block
    lastLine = lineNum
  }

  const text = words.join("").replace(/[ \t]+\n/g, "\n").trim()
  const confidence =
    confidences.length === 0
      ? text
        ? 0.7
        : 0
      : confidences.reduce((a, b) => a + b, 0) / confidences.length / 100

  if (text) {
    return { text, confidence: Math.max(0, Math.min(1, confidence)) }
  }

  // Fallback to plain text output if TSV was empty.
  const plain = await execFileAsync(
    "tesseract",
    [imagePath, "stdout", "-l", "eng", "--psm", "6"],
    { maxBuffer: 20 * 1024 * 1024 }
  )
  return {
    text: plain.stdout.trim(),
    confidence: plain.stdout.trim() ? 0.65 : 0,
  }
}

/**
 * System `tesseract` CLI only.
 * tesseract.js is intentionally unused — its Node worker fails on Vercel
 * ("Cannot find module '..'").
 */
export class TesseractOCRExtractor implements OCRExtractor {
  async extract(input: OCRExtractInput): Promise<OCRExtractResult> {
    const warnings: string[] = []
    const ext = extensionOf(input.fileName)

    if (ext && !IMAGE_EXTENSIONS.has(ext)) {
      return {
        text: "",
        confidence: 0,
        warnings: [`Unsupported image type: ${ext}`],
        method: "none",
        sourceFileName: input.fileName,
      }
    }

    const dir = await mkdtemp(join(tmpdir(), "geoffit-shot-ocr-"))
    try {
      const raster = await ensureRasterImage(dir, input.fileName, input.bytes)
      warnings.push(...raster.warnings)

      try {
        const cli = await ocrWithCli(raster.path)
        return {
          text: cli.text,
          confidence: cli.confidence,
          warnings,
          method: "tesseract-cli",
          sourceFileName: input.fileName,
        }
      } catch (cliError) {
        console.error(
          "[OCRExtractor] system tesseract unavailable",
          cliError
        )
        warnings.push("OCR worker failed to initialise.")
        return {
          text: "",
          confidence: 0,
          warnings,
          method: "none",
          sourceFileName: input.fileName,
        }
      }
    } catch (error) {
      console.error("[OCRExtractor] OCR failed", error)
      warnings.push(
        `OCR failed for ${input.fileName}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
      return {
        text: "",
        confidence: 0,
        warnings,
        method: "none",
        sourceFileName: input.fileName,
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }
}

/** Factory — swap this for an AI extractor later without touching importers. */
export function createDefaultOCRExtractor(): OCRExtractor {
  return new TesseractOCRExtractor()
}

/** Convenience for tests / AI adapters that already have a file on disk. */
export async function readImageBytes(path: string): Promise<Uint8Array> {
  const buf = await readFile(path)
  return new Uint8Array(buf)
}
