/**
 * Apple Health archive / XML open helpers.
 *
 * ZIP path is streaming-only (never materialises the archive or export.xml).
 */

import type { AppleHealthParseOptions } from "./progress"
import {
  STAGE_MESSAGES,
  createEmptyProgressEvent,
  yieldToMain,
} from "./progress"
import {
  openStreamingAppleHealthXml,
  openStreamingExportXmlFromZip,
  type StreamExportXmlResult,
} from "./stream-zip-xml"

export {
  isPrimaryExportXmlPath,
  openStreamingAppleHealthXml,
  openStreamingExportXmlFromZip,
  openStreamingExportXmlFile,
} from "./stream-zip-xml"

export async function* fileByteChunks(
  file: File,
  _chunkSize = 256 * 1024
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

export interface OpenAppleHealthStreamResult {
  stream: AsyncIterable<Uint8Array>
  format: "xml" | "zip"
  entryPath: string | null
  zipEntries: string[]
  /** Always null for the streaming reader — XML is never fully buffered. */
  xmlByteLength: number | null
}

/**
 * Open Apple Health export.xml as a byte stream.
 * For ZIP inputs, only export.xml is inflated; export_cda.xml is ignored.
 */
export async function openAppleHealthXmlStream(
  file: File,
  options: AppleHealthParseOptions = {}
): Promise<OpenAppleHealthStreamResult> {
  options.onProgress?.(
    createEmptyProgressEvent({
      stage: "extracting_xml",
      progress: 8,
      message: STAGE_MESSAGES.extracting_xml,
    })
  )
  await yieldToMain()

  const opened: StreamExportXmlResult = await openStreamingAppleHealthXml(file)

  options.onProgress?.(
    createEmptyProgressEvent({
      stage: "extracting_xml",
      progress: 20,
      message: `Streaming ${opened.entryPath}`,
    })
  )

  return {
    stream: opened.chunks,
    format: opened.format,
    entryPath: opened.entryPath,
    zipEntries: [],
    xmlByteLength: null,
  }
}

/**
 * @deprecated Full-archive inflate removed. Use openStreamingExportXmlFromZip.
 */
export async function extractXmlBytesFromZip(
  file: File,
  _options: AppleHealthParseOptions = {}
): Promise<never> {
  void file
  throw new Error(
    "extractXmlBytesFromZip has been removed. Use openStreamingExportXmlFromZip / runStreamingAppleHealthPipeline."
  )
}
