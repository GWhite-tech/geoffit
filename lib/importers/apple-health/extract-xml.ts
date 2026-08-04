import { unzip } from "fflate"

import { APPLE_HEALTH_XML_NAMES } from "./constants"
import type { AppleHealthParseOptions } from "./progress"
import {
  STAGE_MESSAGES,
  createEmptyProgressEvent,
  createProgressThrottler,
  estimateRemainingSeconds,
  yieldToMain,
} from "./progress"

export async function* fileByteChunks(
  file: File,
  chunkSize = 256 * 1024
): AsyncGenerator<Uint8Array> {
  const reader = file.stream().getReader()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value?.length) yield value
    }
  } finally {
    reader.releaseLock()
  }
}

export async function* uint8ArrayChunks(
  data: Uint8Array,
  chunkSize = 256 * 1024
): AsyncGenerator<Uint8Array> {
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    yield data.subarray(offset, Math.min(offset + chunkSize, data.length))
  }
}

function scoreXmlPath(path: string): number {
  const normalized = path.replace(/\\/g, "/").toLowerCase()
  if (normalized.endsWith("/export.xml")) return 100
  if (normalized.endsWith("/apple_health_export/export.xml")) return 95
  if (APPLE_HEALTH_XML_NAMES.some((name) => normalized.endsWith(`/${name}`))) {
    return 90
  }
  if (normalized.endsWith(".xml") && !normalized.includes("__macosx")) return 50
  return 0
}

export interface AppleHealthZipExtraction {
  bytes: Uint8Array
  entryPath: string
  zipEntries: string[]
}

export async function extractXmlBytesFromZip(
  file: File,
  options: AppleHealthParseOptions = {}
): Promise<AppleHealthZipExtraction> {
  const startedAt = Date.now()
  const throttler = createProgressThrottler(options.onProgress)

  throttler.emit(
    createEmptyProgressEvent({
      stage: "reading_zip",
      progress: 2,
      message: STAGE_MESSAGES.reading_zip,
    }),
    true
  )
  await yieldToMain()

  const buffer = new Uint8Array(await file.arrayBuffer())

  throttler.emit(
    createEmptyProgressEvent({
      stage: "extracting_xml",
      progress: 12,
      estimatedRemainingTime: estimateRemainingSeconds(startedAt, 0.15),
      message: STAGE_MESSAGES.extracting_xml,
    }),
    true
  )
  await yieldToMain()

  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(buffer, (error, data) => {
      if (error) reject(error)
      else resolve(data)
    })
  })

  const zipEntries = Object.keys(entries).sort((a, b) => a.localeCompare(b))

  const candidates = Object.entries(entries)
    .map(([path, bytes]) => ({ path, bytes, score: scoreXmlPath(path) }))
    .filter((entry) => entry.score > 0 && entry.bytes.byteLength > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))

  if (candidates.length === 0) {
    const listing =
      zipEntries.length > 0
        ? `ZIP contains:\n${zipEntries.map((path) => `  - ${path}`).join("\n")}`
        : "ZIP archive is empty."
    throw new Error(
      `No Apple Health export.xml found inside ZIP archive "${file.name}".\n${listing}`
    )
  }

  throttler.emit(
    createEmptyProgressEvent({
      stage: "extracting_xml",
      progress: 20,
      estimatedRemainingTime: estimateRemainingSeconds(startedAt, 0.22),
      message: `Extracted ${candidates[0].path}`,
    }),
    true
  )
  throttler.flush()

  return {
    bytes: candidates[0].bytes,
    entryPath: candidates[0].path,
    zipEntries,
  }
}

export interface OpenAppleHealthStreamResult {
  stream: AsyncGenerator<Uint8Array>
  format: "xml" | "zip"
  entryPath: string | null
  zipEntries: string[]
  xmlByteLength: number | null
}

export async function openAppleHealthXmlStream(
  file: File,
  options: AppleHealthParseOptions = {}
): Promise<OpenAppleHealthStreamResult> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? ""

  if (extension === "xml") {
    options.onProgress?.(
      createEmptyProgressEvent({
        stage: "extracting_xml",
        progress: 8,
        message: "Opening export.xml...",
      })
    )
    await yieldToMain()

    // Buffer-based chunks work in Node and browsers (no ReadableStream dependency).
    const bytes = new Uint8Array(await file.arrayBuffer())
    return {
      stream: uint8ArrayChunks(bytes),
      format: "xml",
      entryPath: file.name,
      zipEntries: [],
      xmlByteLength: bytes.byteLength,
    }
  }

  if (extension === "zip") {
    const { bytes, entryPath, zipEntries } = await extractXmlBytesFromZip(
      file,
      options
    )
    return {
      stream: uint8ArrayChunks(bytes),
      format: "zip",
      entryPath,
      zipEntries,
      xmlByteLength: bytes.byteLength,
    }
  }

  throw new Error("Expected an Apple Health export.xml or export.zip file.")
}
