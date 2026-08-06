/**
 * pdf.js deployment doctor.
 *
 * Proves the full parser environment on every machine / CI / pre-deploy:
 *   ✓ pdfjs ESM import
 *   ✓ assets exist (fonts, cmaps, wasm)
 *   ✓ canvas + in-process worker
 *   ✓ getDocument()
 *   ✓ getTextContent()
 *   ✓ Numan regression fixture
 *   ✓ extracted chars > 5000
 *
 * Usage: pnpm doctor:pdf
 */

import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { join, resolve } from "node:path"

import { assertPdfEnvironmentHealthy } from "../lib/importers/blood-tests/pdf-environment"
import { logPdfBytesBeforeGetDocument } from "../lib/importers/blood-tests/pdf-bytes-fingerprint"

const MIN_EXTRACTED_CHARS = 5000
const FIXTURE = join(
  process.cwd(),
  "fixtures",
  "blood-lab-pdfs",
  "numan",
  "report.pdf"
)

type Check = { name: string; ok: boolean; detail?: string }

async function main(): Promise<void> {
  const checks: Check[] = []
  const fail = (name: string, detail: string): never => {
    checks.push({ name, ok: false, detail })
    printSummary(checks)
    console.error(`\ndoctor:pdf FAILED at ${name}: ${detail}`)
    process.exit(1)
  }

  console.log("=== pnpm doctor:pdf ===\n")

  // 1–3. Environment probe (import, assets, canvas, worker).
  // Assign consts only after success — catch returns never via fail().
  const env = await assertPdfEnvironmentHealthy().catch((error): never =>
    fail(
      "environment probe",
      error instanceof Error ? error.message : String(error)
    )
  )
  const { pdfjs, assetUrls, report } = env

  checks.push({
    name: "pdfjs imports",
    ok: true,
    detail: `v${report.pdfjsVersion}`,
  })
  checks.push({
    name: "assets exist",
    ok: true,
    detail: JSON.stringify(report.assets),
  })
  checks.push({
    name: "canvas",
    ok: report.canvas,
    detail: report.canvas ? "DOMMatrix/ImageData/Path2D" : "missing",
  })
  checks.push({
    name: "workerLoaded",
    ok: report.workerLoaded,
  })
  if (!report.canvas) fail("canvas", "canvas globals not installed")
  if (!report.workerLoaded) fail("workerLoaded", "pdf.worker not loaded")

  // 4–7. Fixture open + text extract
  if (!existsSync(FIXTURE)) {
    fail("regression fixture", `missing ${FIXTURE}`)
  }
  checks.push({ name: "regression fixture", ok: true, detail: FIXTURE })

  const bytes = Uint8Array.from(await readFile(resolve(FIXTURE)))
  const pdfData = Uint8Array.from(bytes)
  logPdfBytesBeforeGetDocument(pdfData, "doctor:pdf", { file: FIXTURE })

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

  const doc = await pdfjs
    .getDocument({
      data: pdfData,
      useSystemFonts: true,
      disableFontFace: true,
      standardFontDataUrl: assetUrls.standardFontDataUrl,
      cMapUrl: assetUrls.cMapUrl,
      cMapPacked: true,
      wasmUrl: assetUrls.wasmUrl,
    })
    .promise.catch((error): never =>
      fail(
        "getDocument()",
        error instanceof Error ? error.message : String(error)
      )
    )

  checks.push({
    name: "getDocument()",
    ok: true,
    detail: `pages=${doc.numPages}`,
  })

  let totalCharacters = 0
  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum)
      const content = await page.getTextContent({ includeMarkedContent: false })
      for (const item of content.items ?? []) {
        if (item && typeof item === "object" && "str" in item) {
          totalCharacters += String((item as { str?: string }).str ?? "").length
        }
      }
    }
  } catch (error) {
    fail(
      "getTextContent()",
      error instanceof Error ? error.message : String(error)
    )
  }

  checks.push({
    name: "getTextContent()",
    ok: true,
    detail: `chars=${totalCharacters}`,
  })

  if (totalCharacters <= MIN_EXTRACTED_CHARS) {
    fail(
      "extracted chars > 5000",
      `got ${totalCharacters}, need > ${MIN_EXTRACTED_CHARS}`
    )
  }
  checks.push({
    name: "extracted chars > 5000",
    ok: true,
    detail: `chars=${totalCharacters}`,
  })

  printSummary(checks)
  console.log("\ndoctor:pdf OK")
}

function printSummary(checks: Check[]): void {
  console.log("\nChecks:")
  for (const check of checks) {
    const mark = check.ok ? "✓" : "✗"
    const detail = check.detail ? ` — ${check.detail}` : ""
    console.log(`  ${mark} ${check.name}${detail}`)
  }
}

main().catch((error) => {
  console.error("doctor:pdf crashed:", error)
  process.exit(1)
})
