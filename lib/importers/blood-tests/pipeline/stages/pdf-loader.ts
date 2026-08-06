import { access, constants } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import {
  DOMMatrix as NodeDOMMatrix,
  ImageData as NodeImageData,
  Path2D as NodePath2D,
} from "@napi-rs/canvas"

import type {
  PdfAssetCheck,
  PdfLoaderDiagnostics,
  StageResult,
} from "../types"
import { logBloodPdfPipeline } from "../log"
import {
  logOpenedDocumentIdentity,
  logUploadBytesIdentity,
} from "../document-identity"

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs")

export type LoadedPdf = {
  pdfjs: PdfJsModule
  doc: Awaited<ReturnType<PdfJsModule["getDocument"]>["promise"]>
  assetUrls: {
    pdfjsRoot: string
    standardFontDataUrl: string
    cMapUrl: string
    wasmUrl: string
  }
  pdfJsWarnings: string[]
}

let pdfjsModulePromise: Promise<PdfJsModule> | null = null

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

async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = (async () => {
      installNodeCanvasGlobals()
      await installInProcessWorkerHandler()
      return import("pdfjs-dist/legacy/build/pdf.mjs")
    })()
  }
  return pdfjsModulePromise
}

export function resolvePdfJsAssetUrls(): LoadedPdf["assetUrls"] {
  const require = createRequire(join(process.cwd(), "package.json"))
  const pdfjsRoot = dirname(require.resolve("pdfjs-dist/package.json"))
  return {
    pdfjsRoot,
    standardFontDataUrl: join(pdfjsRoot, "standard_fonts") + "/",
    cMapUrl: join(pdfjsRoot, "cmaps") + "/",
    wasmUrl: join(pdfjsRoot, "wasm") + "/",
  }
}

async function checkAsset(
  key: PdfAssetCheck["key"],
  dirWithSlash: string
): Promise<PdfAssetCheck> {
  const path = dirWithSlash
  try {
    await access(path, constants.R_OK)
    return { key, path, exists: true, readable: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logBloodPdfPipeline("asset_missing", { key, path, error: message })
    return {
      key,
      path,
      exists: false,
      readable: false,
      error: message,
    }
  }
}

/**
 * Stage: PDF Loader — open document, verify asset paths, capture PDF version.
 * Also logs document identity vs Numan fixture before any biomarker parsing.
 */
export async function runPdfLoaderStage(
  data: Uint8Array,
  fileName: string
): Promise<{
  stage: StageResult<PdfLoaderDiagnostics>
  loaded: LoadedPdf | null
}> {
  const started = performance.now()

  // Identity of bytes first — before getDocument / text extraction.
  const { sha256, comparison } = await logUploadBytesIdentity(data, fileName)

  const assetUrls = resolvePdfJsAssetUrls()
  const pdfJsWarnings: string[] = []
  const assetChecks = await Promise.all([
    checkAsset("standardFontDataUrl", assetUrls.standardFontDataUrl),
    checkAsset("cMapUrl", assetUrls.cMapUrl),
    checkAsset("wasmUrl", assetUrls.wasmUrl),
  ])

  const missing = assetChecks.filter((c) => !c.exists)
  if (missing.length > 0) {
    logBloodPdfPipeline("pdfjs_assets_unresolved", {
      missing: missing.map((m) => ({
        key: m.key,
        path: m.path,
        error: m.error,
      })),
    })
  } else {
    logBloodPdfPipeline("pdfjs_assets_ok", {
      standardFontDataUrl: assetUrls.standardFontDataUrl,
      cMapUrl: assetUrls.cMapUrl,
      cMapPacked: true,
      wasmUrl: assetUrls.wasmUrl,
    })
  }

  try {
    const pdfjs = await loadPdfJs()
    const originalWarn = console.warn
    const warnSpy = (...args: unknown[]) => {
      const msg = args.map(String).join(" ")
      if (/pdf\.js|pdfjs|Warning:/i.test(msg) || args[0] === "Warning:") {
        pdfJsWarnings.push(msg)
      }
      originalWarn.apply(console, args as Parameters<typeof console.warn>)
    }
    console.warn = warnSpy

    let doc: LoadedPdf["doc"]
    try {
      doc = await pdfjs.getDocument({
        data: Uint8Array.from(data),
        useSystemFonts: true,
        disableFontFace: true,
        standardFontDataUrl: assetUrls.standardFontDataUrl,
        cMapUrl: assetUrls.cMapUrl,
        cMapPacked: true,
        wasmUrl: assetUrls.wasmUrl,
      }).promise
    } finally {
      console.warn = originalWarn
    }

    const identity = await logOpenedDocumentIdentity({
      doc,
      originalFilename: fileName,
      sha256,
      byteLength: data.byteLength,
      comparison,
    })

    const diagnostics: PdfLoaderDiagnostics = {
      fileName,
      byteLength: data.byteLength,
      pdfVersion: identity.pdfVersion,
      pageCount: doc.numPages,
      assetChecks,
      cMapPacked: true,
      pdfJsWarnings,
      getDocumentOk: true,
      documentIdentity: {
        sha256,
        producer: identity.producer,
        creator: identity.creator,
        title: identity.title,
        firstPageTitleText: identity.firstPageTitleText,
        firstPageCharCount: identity.firstPageCharCount,
        sameAsNumanFixture: comparison.sameDocument,
        fixtureVerdict: comparison.verdict,
      },
    }

    logBloodPdfPipeline("pdf_loader_ok", {
      pdfVersion: identity.pdfVersion,
      pageCount: doc.numPages,
      byteLength: data.byteLength,
      assetChecks,
      pdfJsWarnings,
      sameAsNumanFixture: comparison.sameDocument,
    })

    return {
      stage: {
        stage: "pdf_loader",
        status: "ok",
        durationMs: Math.round(performance.now() - started),
        diagnostics,
      },
      loaded: { pdfjs, doc, assetUrls, pdfJsWarnings },
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "PDF loader failed."
    logBloodPdfPipeline("pdf_loader_failed", {
      error: message,
      assetChecks,
      pdfJsWarnings,
      sha256,
      byteLength: data.byteLength,
      originalFilename: fileName,
      fixtureComparison: comparison,
    })
    return {
      stage: {
        stage: "pdf_loader",
        status: "failed",
        durationMs: Math.round(performance.now() - started),
        diagnostics: {
          fileName,
          byteLength: data.byteLength,
          pdfVersion: null,
          pageCount: 0,
          assetChecks,
          cMapPacked: true,
          pdfJsWarnings,
          getDocumentOk: false,
          documentIdentity: {
            sha256,
            producer: null,
            creator: null,
            title: null,
            firstPageTitleText: null,
            firstPageCharCount: null,
            sameAsNumanFixture: comparison.sameDocument,
            fixtureVerdict: comparison.verdict,
          },
        },
        error: "PDF text extraction failed.",
      },
      loaded: null,
    }
  }
}
