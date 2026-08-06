/**
 * Standalone pdf.js extraction probe.
 *
 * Bootstraps pdf.js the same way as production (canvas globals + in-process
 * worker handler + standardFontDataUrl/cMapUrl/wasmUrl) without importing
 * Geoffit pipeline / OCR / biomarker code.
 *
 * Usage:
 *   pnpm tsx scripts/debug-pdf.ts fixtures/blood-lab-pdfs/numan/report.pdf
 */

import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"
import {
  DOMMatrix as NodeDOMMatrix,
  ImageData as NodeImageData,
  Path2D as NodePath2D,
} from "@napi-rs/canvas"

import { logPdfBytesBeforeGetDocument } from "../lib/importers/blood-tests/pdf-bytes-fingerprint"

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs")

function installNodeCanvasGlobals(): void {
  const g = globalThis as Record<string, unknown>
  if (!g.DOMMatrix) g.DOMMatrix = NodeDOMMatrix
  if (!g.ImageData) g.ImageData = NodeImageData
  if (!g.Path2D) g.Path2D = NodePath2D
}

async function installInProcessWorkerHandler(): Promise<void> {
  const g = globalThis as typeof globalThis & {
    pdfjsWorker?: { WorkerMessageHandler?: unknown }
  }
  if (g.pdfjsWorker?.WorkerMessageHandler) return
  // @ts-expect-error pdfjs-dist ships worker .mjs without declaration
  const workerMod = await import("pdfjs-dist/legacy/build/pdf.worker.mjs")
  g.pdfjsWorker = workerMod
}

function resolvePdfJsAssetUrls(): {
  pdfjsRoot: string
  standardFontDataUrl: string
  cMapUrl: string
  wasmUrl: string
} {
  // Same as production: resolve via pdf.mjs entry, never package.json.
  const require = createRequire(import.meta.url)
  const pdfEntry = require.resolve("pdfjs-dist/legacy/build/pdf.mjs")
  const pdfjsRoot = join(dirname(pdfEntry), "..", "..")
  return {
    pdfjsRoot,
    standardFontDataUrl: join(pdfjsRoot, "standard_fonts") + "/",
    cMapUrl: join(pdfjsRoot, "cmaps") + "/",
    wasmUrl: join(pdfjsRoot, "wasm") + "/",
  }
}

async function loadPdfJs(): Promise<PdfJsModule> {
  installNodeCanvasGlobals()
  await installInProcessWorkerHandler()
  return import("pdfjs-dist/legacy/build/pdf.mjs")
}

async function main(): Promise<void> {
  const pdfPath = process.argv[2]
  if (!pdfPath) {
    console.error("Usage: pnpm tsx scripts/debug-pdf.ts <path-to.pdf>")
    process.exit(1)
  }

  const absolutePath = resolve(process.cwd(), pdfPath)
  const fileBuffer = await readFile(absolutePath)
  // Match production: plain copy (avoid Node Buffer ArrayBuffer-pool pitfalls).
  const bytes = Uint8Array.from(fileBuffer)
  const assetUrls = resolvePdfJsAssetUrls()
  const pdfjs = await loadPdfJs()

  console.log("=== debug-pdf ===")
  console.log("file:", absolutePath)
  console.log("byteLength:", bytes.byteLength)
  console.log("pdf.js version:", pdfjs.version)

  // Exact bytes passed to pdf.js — same fingerprint helper as Geoffit.
  const pdfData = Uint8Array.from(bytes)
  logPdfBytesBeforeGetDocument(pdfData, "standalone.debug-pdf", {
    file: absolutePath,
  })

  const doc = await pdfjs.getDocument({
    data: pdfData,
    useSystemFonts: true,
    disableFontFace: true,
    standardFontDataUrl: assetUrls.standardFontDataUrl,
    cMapUrl: assetUrls.cMapUrl,
    cMapPacked: true,
    wasmUrl: assetUrls.wasmUrl,
  }).promise

  let metadata: unknown = null
  try {
    metadata = await doc.getMetadata()
  } catch (error) {
    metadata = {
      error: error instanceof Error ? error.message : String(error),
    }
  }

  console.log("page count:", doc.numPages)
  console.log("metadata:", JSON.stringify(metadata, null, 2))
  console.log("assets:", JSON.stringify(assetUrls, null, 2))

  // Attach pageCount to fingerprint comparison in logs (post-open).
  console.info(
    JSON.stringify({
      scope: "pdf-bytes-fingerprint",
      event: "after_getDocument_pageCount",
      source: "standalone.debug-pdf",
      pageCount: doc.numPages,
    })
  )

  let totalCharacters = 0
  const first100Items: string[] = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent({ includeMarkedContent: false })
    const items = content.items ?? []
    const strs = items.map((item) =>
      item && typeof item === "object" && "str" in item
        ? String((item as { str?: string }).str ?? "")
        : ""
    )
    const pageChars = strs.join("").length
    totalCharacters += pageChars

    console.log(
      `page ${pageNum}: textItemCount=${items.length} characters=${pageChars}`
    )

    for (const s of strs) {
      if (first100Items.length >= 100) break
      first100Items.push(s)
    }
  }

  console.log("first 100 text items:")
  console.log(JSON.stringify(first100Items, null, 2))
  console.log("total extracted characters:", totalCharacters)
}

main().catch((error) => {
  console.error("debug-pdf failed:", error)
  process.exit(1)
})
