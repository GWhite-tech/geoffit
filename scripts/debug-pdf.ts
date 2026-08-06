/**
 * Standalone pdf.js extraction probe.
 *
 * Bootstraps pdf.js the same way as production via assertPdfEnvironmentHealthy.
 *
 * Usage:
 *   pnpm tsx scripts/debug-pdf.ts fixtures/blood-lab-pdfs/numan/report.pdf
 */

import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import { assertPdfEnvironmentHealthy } from "../lib/importers/blood-tests/pdf-environment"
import { logPdfBytesBeforeGetDocument } from "../lib/importers/blood-tests/pdf-bytes-fingerprint"

async function main(): Promise<void> {
  const pdfPath = process.argv[2]
  if (!pdfPath) {
    console.error("Usage: pnpm tsx scripts/debug-pdf.ts <path-to.pdf>")
    process.exit(1)
  }

  const absolutePath = resolve(process.cwd(), pdfPath)
  const fileBuffer = await readFile(absolutePath)
  const bytes = Uint8Array.from(fileBuffer)
  const { report, pdfjs, assetUrls } = await assertPdfEnvironmentHealthy()

  console.log("=== debug-pdf ===")
  console.log("file:", absolutePath)
  console.log("byteLength:", bytes.byteLength)
  console.log("pdf.js version:", pdfjs.version)
  console.log("environment healthy:", report.healthy)

  const pdfData = Uint8Array.from(bytes)
  logPdfBytesBeforeGetDocument(pdfData, "standalone.debug-pdf", {
    file: absolutePath,
  })

  console.info({
    scope: "pdfjs-assets-before-getDocument",
    standardFontsExists: existsSync(assetUrls.standardFontDataUrl),
    cMapsExists: existsSync(assetUrls.cMapUrl),
    wasmExists: existsSync(assetUrls.wasmUrl),
    standardFontsPath: assetUrls.standardFontDataUrl,
    cMapsPath: assetUrls.cMapUrl,
    wasmPath: assetUrls.wasmUrl,
    cwd: process.cwd(),
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
