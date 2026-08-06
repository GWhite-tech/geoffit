/**
 * pdf.js runtime bootstrap + environment probe.
 * Proves canvas, worker, ESM import, and asset dirs before any PDF is opened.
 */

import { existsSync } from "node:fs"
import {
  DOMMatrix as NodeDOMMatrix,
  ImageData as NodeImageData,
  Path2D as NodePath2D,
} from "@napi-rs/canvas"

import {
  getPdfJsAssetPaths,
  toPdfJsAssetUrls,
  type PdfJsAssetUrls,
} from "./pdfjs-asset-urls"

export type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs")

export type PdfEnvironmentReport = {
  scope: "pdf_environment"
  healthy: boolean
  pdfjsVersion: string | null
  nodeVersion: string
  runtime: "node"
  cwd: string
  assets: {
    standardFonts: boolean
    cmaps: boolean
    wasm: boolean
    paths: {
      standardFonts: string
      cmaps: string
      wasm: string
      pdfjsRoot: string
    }
  }
  canvas: boolean
  workerLoaded: boolean
  pdfjsImported: boolean
  failures: string[]
}

export class PdfEnvironmentUnhealthyError extends Error {
  readonly code = "PDF_ENVIRONMENT_UNHEALTHY" as const
  readonly report: PdfEnvironmentReport

  constructor(report: PdfEnvironmentReport) {
    super(
      [
        "PDF_ENVIRONMENT_UNHEALTHY",
        ...report.failures,
        `report=${JSON.stringify(report)}`,
      ].join(" | ")
    )
    this.name = "PDF_ENVIRONMENT_UNHEALTHY"
    this.report = report
  }
}

let pdfjsModulePromise: Promise<PdfJsModule> | null = null

export function installNodeCanvasGlobals(): boolean {
  try {
    const g = globalThis as Record<string, unknown>
    if (!g.DOMMatrix) g.DOMMatrix = NodeDOMMatrix
    if (!g.ImageData) g.ImageData = NodeImageData
    if (!g.Path2D) g.Path2D = NodePath2D
    return (
      typeof g.DOMMatrix === "function" &&
      typeof g.ImageData === "function" &&
      typeof g.Path2D === "function"
    )
  } catch {
    return false
  }
}

export async function installInProcessWorkerHandler(): Promise<boolean> {
  try {
    const g = globalThis as typeof globalThis & {
      pdfjsWorker?: { WorkerMessageHandler?: unknown }
    }
    if (!g.pdfjsWorker?.WorkerMessageHandler) {
      // @ts-expect-error pdfjs-dist ships worker .mjs without declaration
      const workerMod = await import("pdfjs-dist/legacy/build/pdf.worker.mjs")
      g.pdfjsWorker = workerMod
    }
    return typeof g.pdfjsWorker?.WorkerMessageHandler !== "undefined"
  } catch {
    return false
  }
}

export async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = (async () => {
      installNodeCanvasGlobals()
      await installInProcessWorkerHandler()
      return import("pdfjs-dist/legacy/build/pdf.mjs")
    })()
  }
  return pdfjsModulePromise
}

/**
 * Probe every pdf.js dependency. Does not open a PDF.
 * Logs + returns the report; use assertPdfEnvironmentHealthy to fail hard.
 */
export async function probePdfEnvironment(): Promise<{
  report: PdfEnvironmentReport
  pdfjs: PdfJsModule | null
  assetUrls: PdfJsAssetUrls | null
}> {
  const failures: string[] = []
  let pdfjs: PdfJsModule | null = null
  let assetUrls: PdfJsAssetUrls | null = null

  const canvas = installNodeCanvasGlobals()
  if (!canvas) failures.push("canvas_globals_missing")

  const workerLoaded = await installInProcessWorkerHandler()
  if (!workerLoaded) failures.push("worker_not_loaded")

  let pdfjsImported = false
  let pdfjsVersion: string | null = null
  try {
    pdfjs = await loadPdfJs()
    pdfjsImported = true
    pdfjsVersion = typeof pdfjs.version === "string" ? pdfjs.version : null
    if (!pdfjsVersion) failures.push("pdfjs_version_missing")
  } catch (error) {
    failures.push(
      `pdfjs_import_failed:${error instanceof Error ? error.message : String(error)}`
    )
  }

  let standardFonts = false
  let cmaps = false
  let wasm = false
  let paths = {
    standardFonts: "",
    cmaps: "",
    wasm: "",
    pdfjsRoot: "",
  }
  try {
    const assetPaths = getPdfJsAssetPaths()
    assetUrls = toPdfJsAssetUrls(assetPaths)
    standardFonts = assetPaths.standardFontsExists
    cmaps = assetPaths.cMapsExists
    wasm = assetPaths.wasmExists
    paths = {
      standardFonts: assetPaths.standardFonts,
      cmaps: assetPaths.cMaps,
      wasm: assetPaths.wasm,
      pdfjsRoot: assetPaths.pdfjsRoot,
    }
  } catch (error) {
    // Still record existsSync against expected cwd paths for the report.
    const { join } = await import("node:path")
    const pdfjsRoot = join(
      /* turbopackIgnore: true */ process.cwd(),
      "node_modules",
      "pdfjs-dist"
    )
    paths = {
      pdfjsRoot,
      standardFonts: join(pdfjsRoot, "standard_fonts") + "/",
      cmaps: join(pdfjsRoot, "cmaps") + "/",
      wasm: join(pdfjsRoot, "wasm") + "/",
    }
    standardFonts = existsSync(/* turbopackIgnore: true */ paths.standardFonts)
    cmaps = existsSync(/* turbopackIgnore: true */ paths.cmaps)
    wasm = existsSync(/* turbopackIgnore: true */ paths.wasm)
    failures.push(
      error instanceof Error ? error.message : `assets_failed:${String(error)}`
    )
  }

  if (!standardFonts) failures.push("standard_fonts_missing")
  if (!cmaps) failures.push("cmaps_missing")
  if (!wasm) failures.push("wasm_missing")

  const report: PdfEnvironmentReport = {
    scope: "pdf_environment",
    healthy: failures.length === 0,
    pdfjsVersion,
    nodeVersion: process.versions.node,
    runtime: "node",
    cwd: /* turbopackIgnore: true */ process.cwd(),
    assets: {
      standardFonts,
      cmaps,
      wasm,
      paths,
    },
    canvas,
    workerLoaded,
    pdfjsImported,
    failures,
  }

  console.info(JSON.stringify(report))

  return { report, pdfjs, assetUrls }
}

/** Probe and throw PDF_ENVIRONMENT_UNHEALTHY if any dependency failed. */
export async function assertPdfEnvironmentHealthy(): Promise<{
  report: PdfEnvironmentReport
  pdfjs: PdfJsModule
  assetUrls: PdfJsAssetUrls
}> {
  const { report, pdfjs, assetUrls } = await probePdfEnvironment()
  if (!report.healthy || !pdfjs || !assetUrls) {
    throw new PdfEnvironmentUnhealthyError(report)
  }
  return { report, pdfjs, assetUrls }
}
