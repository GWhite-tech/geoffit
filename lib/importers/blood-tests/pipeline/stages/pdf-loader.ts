import { existsSync } from "node:fs"

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
import { logPdfBytesBeforeGetDocument } from "../../pdf-bytes-fingerprint"
import {
  assertPdfEnvironmentHealthy,
  loadPdfJs,
} from "../../pdf-environment"
import {
  getPdfJsAssetPaths,
  resolvePdfJsAssetUrls,
  type PdfJsAssetUrls,
} from "../../pdfjs-asset-urls"

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs")

export type LoadedPdf = {
  pdfjs: PdfJsModule
  doc: Awaited<ReturnType<PdfJsModule["getDocument"]>["promise"]>
  assetUrls: PdfJsAssetUrls
  pdfJsWarnings: string[]
}

export { resolvePdfJsAssetUrls, getPdfJsAssetPaths, loadPdfJs }

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
  console.info("START_PDF_LOADER", {
    fileName,
    byteLength: data.byteLength,
    ts: new Date().toISOString(),
  })
  const started = performance.now()

  // Identity of bytes first — before getDocument / text extraction.
  const { sha256, comparison } = await logUploadBytesIdentity(data, fileName)

  const pdfJsWarnings: string[] = []
  let assetUrls: PdfJsAssetUrls | null = null
  let assetChecks: PdfAssetCheck[] = []

  try {
    // Prove the whole parser environment before touching the PDF.
    const { report, pdfjs, assetUrls: urls } =
      await assertPdfEnvironmentHealthy()
    assetUrls = urls
    assetChecks = [
      {
        key: "standardFontDataUrl",
        path: report.assets.paths.standardFonts,
        exists: report.assets.standardFonts,
        readable: report.assets.standardFonts,
      },
      {
        key: "cMapUrl",
        path: report.assets.paths.cmaps,
        exists: report.assets.cmaps,
        readable: report.assets.cmaps,
      },
      {
        key: "wasmUrl",
        path: report.assets.paths.wasm,
        exists: report.assets.wasm,
        readable: report.assets.wasm,
      },
    ]
    logBloodPdfPipeline("pdfjs_assets_ok", {
      standardFontDataUrl: assetUrls.standardFontDataUrl,
      cMapUrl: assetUrls.cMapUrl,
      cMapPacked: true,
      wasmUrl: assetUrls.wasmUrl,
      environment: report,
    })

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
      // Exact bytes passed to pdf.js — fingerprint AFTER copy, BEFORE getDocument.
      const pdfData = Uint8Array.from(data)
      logPdfBytesBeforeGetDocument(pdfData, "geoffit.pdf_loader", {
        originalFilename: fileName,
        inputByteLength: data.byteLength,
        inputSha256: sha256,
      })

      const standardFontsPath = assetUrls.standardFontDataUrl
      const cMapsPath = assetUrls.cMapUrl
      const wasmPath = assetUrls.wasmUrl
      console.info({
        scope: "pdfjs-assets-before-getDocument",
        standardFontsExists: existsSync(standardFontsPath),
        cMapsExists: existsSync(cMapsPath),
        wasmExists: existsSync(wasmPath),
        standardFontsPath,
        cMapsPath,
        wasmPath,
        cwd: process.cwd(),
      })

      doc = await pdfjs.getDocument({
        data: pdfData,
        useSystemFonts: true,
        disableFontFace: true,
        standardFontDataUrl: standardFontsPath,
        cMapUrl: cMapsPath,
        cMapPacked: true,
        wasmUrl: wasmPath,
      }).promise

      console.info(
        JSON.stringify({
          scope: "pdf-bytes-fingerprint",
          event: "after_getDocument_pageCount",
          source: "geoffit.pdf_loader",
          pageCount: doc.numPages,
          sha256,
          byteLength: data.byteLength,
        })
      )
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
    const isEnv =
      message.startsWith("PDFJS_ASSETS_NOT_FOUND") ||
      message.startsWith("PDF_ENVIRONMENT_UNHEALTHY")
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
        error: isEnv ? message : "PDF text extraction failed.",
      },
      loaded: null,
    }
  }
}
