/**
 * pdf.js asset directory locations — ESM-safe, no createRequire / require.resolve.
 *
 * Paths are under process.cwd()/node_modules/pdfjs-dist at runtime.
 * process.cwd() is marked turbopackIgnore so NFT does not fall back to
 * tracing the entire project (which invalidates the Vercel serverless package).
 */

import { existsSync } from "node:fs"
import { join } from "node:path"

export type PdfJsAssetPaths = {
  /** Trailing-slash directory path for getDocument({ standardFontDataUrl }). */
  standardFonts: string
  /** Trailing-slash directory path for getDocument({ cMapUrl }). */
  cMaps: string
  /** Trailing-slash directory path for getDocument({ wasmUrl }). */
  wasm: string
  pdfjsRoot: string
  standardFontsExists: boolean
  cMapsExists: boolean
  wasmExists: boolean
}

/** Legacy shape used by getDocument option names / diagnostics. */
export type PdfJsAssetUrls = {
  pdfjsRoot: string
  standardFontDataUrl: string
  cMapUrl: string
  wasmUrl: string
}

export class PdfJsAssetsNotFoundError extends Error {
  readonly code = "PDFJS_ASSETS_NOT_FOUND" as const
  readonly paths: {
    standardFonts: string
    cMaps: string
    wasm: string
    pdfjsRoot: string
  }
  readonly exists: {
    standardFontsExists: boolean
    cMapsExists: boolean
    wasmExists: boolean
  }

  constructor(paths: PdfJsAssetPaths) {
    super(
      [
        "PDFJS_ASSETS_NOT_FOUND",
        `cwd=${/* turbopackIgnore: true */ process.cwd()}`,
        `pdfjsRoot=${paths.pdfjsRoot}`,
        `standardFonts=${paths.standardFonts} exists=${paths.standardFontsExists}`,
        `cMaps=${paths.cMaps} exists=${paths.cMapsExists}`,
        `wasm=${paths.wasm} exists=${paths.wasmExists}`,
      ].join(" | ")
    )
    this.name = "PDFJS_ASSETS_NOT_FOUND"
    this.paths = {
      standardFonts: paths.standardFonts,
      cMaps: paths.cMaps,
      wasm: paths.wasm,
      pdfjsRoot: paths.pdfjsRoot,
    }
    this.exists = {
      standardFontsExists: paths.standardFontsExists,
      cMapsExists: paths.cMapsExists,
      wasmExists: paths.wasmExists,
    }
  }
}

function pdfjsRootDir(): string {
  // Scoped to node_modules/pdfjs-dist only — ignore cwd for NFT whole-project fallback.
  return join(
    /* turbopackIgnore: true */ process.cwd(),
    "node_modules",
    "pdfjs-dist"
  )
}

/**
 * Resolve + validate pdf.js asset dirs. Throws PDFJS_ASSETS_NOT_FOUND if any
 * directory is missing (proves whether the deployment shipped them).
 * Call only at request time — never at module top level.
 */
export function getPdfJsAssetPaths(): PdfJsAssetPaths {
  const pdfjsRoot = pdfjsRootDir()
  const standardFonts = join(pdfjsRoot, "standard_fonts") + "/"
  const cMaps = join(pdfjsRoot, "cmaps") + "/"
  const wasm = join(pdfjsRoot, "wasm") + "/"

  const paths: PdfJsAssetPaths = {
    pdfjsRoot,
    standardFonts,
    cMaps,
    wasm,
    standardFontsExists: existsSync(/* turbopackIgnore: true */ standardFonts),
    cMapsExists: existsSync(/* turbopackIgnore: true */ cMaps),
    wasmExists: existsSync(/* turbopackIgnore: true */ wasm),
  }

  if (
    !paths.standardFontsExists ||
    !paths.cMapsExists ||
    !paths.wasmExists
  ) {
    throw new PdfJsAssetsNotFoundError(paths)
  }

  return paths
}

/** Map validated paths into getDocument option names. */
export function toPdfJsAssetUrls(paths: PdfJsAssetPaths): PdfJsAssetUrls {
  return {
    pdfjsRoot: paths.pdfjsRoot,
    standardFontDataUrl: paths.standardFonts,
    cMapUrl: paths.cMaps,
    wasmUrl: paths.wasm,
  }
}

/** @deprecated Prefer getPdfJsAssetPaths() — validates existence. */
export function resolvePdfJsAssetUrls(): PdfJsAssetUrls {
  return toPdfJsAssetUrls(getPdfJsAssetPaths())
}
