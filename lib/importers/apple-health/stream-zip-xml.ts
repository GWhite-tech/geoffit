/**
 * Streaming Apple Health ZIP → export.xml byte source.
 *
 * Uses yauzl + zlib so only export.xml is inflated, in small chunks,
 * with Node stream backpressure. Never materialises export.xml or CDA.
 */

import { Readable } from "node:stream"

import yauzl from "yauzl"

import { APPLE_HEALTH_XML_NAMES } from "./constants"
import { logAppleHealthMemory } from "./memory-log"

export type StreamExportXmlResult = {
  chunks: AsyncIterable<Uint8Array>
  entryPath: string
  format: "zip" | "xml"
}

function normalizeZipPath(path: string): string {
  return path.replace(/\\/g, "/").toLowerCase()
}

/** True only for the primary Apple Health export.xml — never CDA. */
export function isPrimaryExportXmlPath(path: string): boolean {
  const normalized = normalizeZipPath(path)
  if (normalized.includes("export_cda")) return false
  if (normalized.endsWith("/export.xml") || normalized === "export.xml") {
    return true
  }
  return APPLE_HEALTH_XML_NAMES.some(
    (name) =>
      normalized === name.toLowerCase() ||
      normalized.endsWith(`/${name.toLowerCase()}`)
  )
}

function fromBufferPromise(
  buffer: Buffer
): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zipfile) => {
      if (error || !zipfile) reject(error ?? new Error("Failed to open ZIP"))
      else resolve(zipfile)
    })
  })
}

function openReadStreamPromise(
  zipfile: yauzl.ZipFile,
  entry: yauzl.Entry
): Promise<Readable> {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (error, stream) => {
      if (error || !stream) reject(error ?? new Error("Failed to open ZIP entry"))
      else resolve(stream)
    })
  })
}

function readEntryPromise(zipfile: yauzl.ZipFile): Promise<yauzl.Entry | null> {
  return new Promise((resolve, reject) => {
    const onEntry = (entry: yauzl.Entry) => {
      cleanup()
      resolve(entry)
    }
    const onEnd = () => {
      cleanup()
      resolve(null)
    }
    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    const cleanup = () => {
      zipfile.removeListener("entry", onEntry)
      zipfile.removeListener("end", onEnd)
      zipfile.removeListener("error", onError)
    }
    zipfile.on("entry", onEntry)
    zipfile.on("end", onEnd)
    zipfile.on("error", onError)
    zipfile.readEntry()
  })
}

async function findPrimaryExportEntry(
  zipfile: yauzl.ZipFile
): Promise<yauzl.Entry> {
  for (;;) {
    const entry = await readEntryPromise(zipfile)
    if (!entry) {
      throw new Error("No Apple Health export.xml found inside ZIP archive.")
    }
    if (isPrimaryExportXmlPath(entry.fileName)) {
      return entry
    }
    // Skip export_cda.xml and every other member — do not openReadStream.
  }
}

async function* readableToUint8Chunks(
  stream: Readable
): AsyncGenerator<Uint8Array> {
  for await (const chunk of stream) {
    if (typeof chunk === "string") {
      yield new TextEncoder().encode(chunk)
    } else if (chunk instanceof Uint8Array) {
      yield chunk
    } else if (Buffer.isBuffer(chunk)) {
      yield new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
    }
  }
}

/**
 * Open a ZIP File and yield decompressed export.xml chunks only.
 * Central directory is scanned; only the primary export.xml entry is inflated.
 */
export async function openStreamingExportXmlFromZip(
  file: File
): Promise<StreamExportXmlResult> {
  logAppleHealthMemory("zip_open", "before", {
    fileName: file.name,
    fileSize: file.size,
  })

  // ZIP container only (~100MB) — not the uncompressed XML.
  const zipBuffer = Buffer.from(await file.arrayBuffer())
  const zipfile = await fromBufferPromise(zipBuffer)
  const entry = await findPrimaryExportEntry(zipfile)

  logAppleHealthMemory("zip_open", "after", {
    fileName: file.name,
    fileSize: file.size,
    entryPath: entry.fileName,
    compressedSize: entry.compressedSize,
    uncompressedSize: entry.uncompressedSize,
  })

  const entryPath = entry.fileName

  async function* chunks(): AsyncGenerator<Uint8Array> {
    logAppleHealthMemory("xml_stream_open", "before", {
      entryPath,
      uncompressedSize: entry.uncompressedSize,
    })

    const readStream = await openReadStreamPromise(zipfile, entry)

    logAppleHealthMemory("xml_stream_open", "after", {
      entryPath,
    })

    try {
      for await (const chunk of readableToUint8Chunks(readStream)) {
        yield chunk
      }
    } finally {
      zipfile.close()
    }
  }

  return {
    chunks: chunks(),
    entryPath,
    format: "zip",
  }
}

/** Stream an already-unpacked export.xml File without loading it whole. */
export async function openStreamingExportXmlFile(
  file: File
): Promise<StreamExportXmlResult> {
  logAppleHealthMemory("zip_open", "before", {
    fileName: file.name,
    fileSize: file.size,
    format: "xml",
  })
  logAppleHealthMemory("zip_open", "after", {
    fileName: file.name,
    fileSize: file.size,
    format: "xml",
  })

  async function* chunks(): AsyncGenerator<Uint8Array> {
    logAppleHealthMemory("xml_stream_open", "before", {
      entryPath: file.name,
    })
    logAppleHealthMemory("xml_stream_open", "after", {
      entryPath: file.name,
    })

    const reader = file.stream().getReader()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (value?.byteLength) yield value
      }
    } finally {
      reader.releaseLock()
    }
  }

  return {
    chunks: chunks(),
    entryPath: file.name,
    format: "xml",
  }
}

export async function openStreamingAppleHealthXml(
  file: File
): Promise<StreamExportXmlResult> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (extension === "xml") return openStreamingExportXmlFile(file)
  if (extension === "zip") return openStreamingExportXmlFromZip(file)
  throw new Error("Expected an Apple Health export.xml or export.zip file.")
}
