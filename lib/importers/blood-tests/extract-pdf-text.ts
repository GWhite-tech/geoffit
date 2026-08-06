import "server-only"

/**
 * Server-only PDF text extraction (Node.js runtime).
 * Never import this module from a Client Component or Edge Runtime.
 *
 * Canvas: `@napi-rs/canvas` supplies real DOMMatrix/ImageData/Path2D before
 * pdf.mjs evaluates (Mozilla's Node backend — not hand-rolled stubs).
 *
 * Worker: pdfjs 6.x on Node always disables real Workers, then uses an
 * in-process "fake worker" (LoopbackPort) that still needs WorkerMessageHandler.
 * Default workerSrc is "./pdf.worker.mjs" (relative) which fails under
 * Next/Vercel. We preload the worker bundle onto `globalThis.pdfjsWorker` so
 * that path never dynamic-imports workerSrc. Same Node process; no Worker(),
 * no workerSrc assignment.
 */

import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import {
  DOMMatrix as NodeDOMMatrix,
  ImageData as NodeImageData,
  Path2D as NodePath2D,
} from "@napi-rs/canvas"

const execFileAsync = promisify(execFile)

export interface PdfExtractResult {
  text: string
  pageCount: number
  method: "text" | "ocr" | "hybrid"
  warnings: string[]
}

const MIN_NATIVE_CHARS = 120

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs")

let pdfjsModulePromise: Promise<PdfJsModule> | null = null

function installNodeCanvasGlobals(): void {
  const g = globalThis as Record<string, unknown>
  if (!g.DOMMatrix) g.DOMMatrix = NodeDOMMatrix
  if (!g.ImageData) g.ImageData = NodeImageData
  if (!g.Path2D) g.Path2D = NodePath2D
}

/**
 * Make PDFWorker.#mainThreadWorkerMessageHandler resolve without
 * `import(GlobalWorkerOptions.workerSrc)` (defaults to "./pdf.worker.mjs").
 */
async function installInProcessWorkerHandler(): Promise<void> {
  const g = globalThis as typeof globalThis & {
    pdfjsWorker?: { WorkerMessageHandler?: unknown }
  }
  if (g.pdfjsWorker?.WorkerMessageHandler) return

  // Package-absolute import — resolvable on Vercel; runs in this process.
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

export async function extractPdfTextFromBuffer(
  data: Uint8Array,
  fileName = "upload.pdf"
): Promise<PdfExtractResult> {
  const warnings: string[] = []
  const pdfjs = await loadPdfJs()

  // Plain ArrayBuffer-backed view for pdfjs Node expectations.
  // Do not set GlobalWorkerOptions.workerSrc — handler is on globalThis.pdfjsWorker.
  const pdfBytes = Uint8Array.from(data)

  const doc = await pdfjs.getDocument({
    data: pdfBytes,
    useSystemFonts: true,
    disableFontFace: true,
  }).promise

  const pageCount = doc.numPages
  const nativePages: string[] = []
  let nativeChars = 0

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()
    const lines = groupTextItems(content.items)
    nativePages.push(lines.join("\n"))
    nativeChars += lines.join("").length
  }

  const nativeText = nativePages.join("\n\n")

  if (nativeChars >= MIN_NATIVE_CHARS && hasBiomarkerSignal(nativeText)) {
    return {
      text: nativeText,
      pageCount,
      method: "text",
      warnings,
    }
  }

  warnings.push(
    nativeChars < MIN_NATIVE_CHARS
      ? "PDF has little selectable text — running server OCR on scanned pages."
      : "Native text did not look like a lab table — running server OCR."
  )

  const ocrPages: string[] = []
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await doc.getPage(pageNum)
    const image = await extractLargestPageImage(page, pdfjs.OPS.paintImageXObject)
    if (!image) {
      warnings.push(`Page ${pageNum}: no embedded image found for OCR.`)
      ocrPages.push("")
      continue
    }

    try {
      const text = await ocrRgbImage(image.width, image.height, image.data)
      ocrPages.push(text)
    } catch (error) {
      warnings.push(
        `Page ${pageNum}: OCR failed (${
          error instanceof Error ? error.message : String(error)
        }).`
      )
      ocrPages.push("")
    }
  }

  const ocrText = ocrPages.join("\n\n")
  const method = nativeChars > 40 ? ("hybrid" as const) : ("ocr" as const)

  if (!ocrText.trim() && !nativeText.trim()) {
    warnings.push(
      `Could not extract text from ${fileName}. Ensure the PDF is readable.`
    )
  }

  return {
    text: method === "hybrid" ? `${nativeText}\n\n${ocrText}` : ocrText,
    pageCount,
    method,
    warnings,
  }
}

function hasBiomarkerSignal(text: string): boolean {
  return (
    /Identifier\s+Observation/i.test(text) ||
    /\b(HbA1c|Testosterone|LDL|HDL|Triglycerides|TSH)\b/i.test(text)
  )
}

function groupTextItems(items: unknown[]): string[] {
  const lines: string[] = []
  let lastY: number | null = null
  let line = ""

  for (const raw of items) {
    const item = raw as { str?: string; transform?: number[] }
    if (!item.str) continue
    const y = item.transform?.[5]
    if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 2) {
      if (line.trim()) lines.push(line.trim())
      line = item.str
    } else {
      line +=
        (line && !line.endsWith(" ") && item.str && !item.str.startsWith(" ")
          ? " "
          : "") + item.str
    }
    if (y !== undefined) lastY = y
  }
  if (line.trim()) lines.push(line.trim())
  return lines
}

async function extractLargestPageImage(
  page: {
    getOperatorList: () => Promise<{
      fnArray: number[]
      argsArray: unknown[][]
    }>
    objs: {
      get: (name: string, callback?: (value: unknown) => void) => unknown
    }
  },
  paintImageOp: number
): Promise<{ width: number; height: number; data: Uint8ClampedArray } | null> {
  const ops = await page.getOperatorList()
  let best: { width: number; height: number; data: Uint8ClampedArray } | null =
    null

  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] !== paintImageOp) continue
    const name = ops.argsArray[i]?.[0]
    if (typeof name !== "string") continue

    const img = await resolveImageObject(page, name)
    if (!img?.data || !img.width || !img.height) continue

    const pixels = img.width * img.height
    if (!best || pixels > best.width * best.height) {
      const data =
        img.data instanceof Uint8ClampedArray
          ? img.data
          : new Uint8ClampedArray(img.data)
      best = { width: img.width, height: img.height, data }
    }
  }

  return best
}

async function resolveImageObject(
  page: {
    objs: {
      get: (name: string, callback?: (value: unknown) => void) => unknown
    }
  },
  name: string
): Promise<{
  width?: number
  height?: number
  data?: Uint8ClampedArray | Uint8Array
} | null> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: unknown) => {
      if (settled) return
      settled = true
      resolve(
        (value as {
          width?: number
          height?: number
          data?: Uint8ClampedArray | Uint8Array
        }) ?? null
      )
    }

    try {
      page.objs.get(name, finish)
    } catch {
      finish(null)
      return
    }

    setTimeout(() => {
      try {
        finish(page.objs.get(name))
      } catch {
        finish(null)
      }
    }, 100)
  })
}

async function ocrRgbImage(
  width: number,
  height: number,
  data: Uint8ClampedArray
): Promise<string> {
  const channels = Math.max(1, Math.round(data.length / (width * height)))
  const bmp = rgbToBmp(width, height, data, channels)
  const dir = await mkdtemp(join(tmpdir(), "geoffit-blood-ocr-"))
  const imagePath = join(dir, "page.bmp")

  try {
    await writeFile(imagePath, bmp)

    try {
      const { stdout } = await execFileAsync(
        "tesseract",
        [imagePath, "stdout", "-l", "eng", "--psm", "4"],
        { maxBuffer: 10 * 1024 * 1024 }
      )
      return stdout
    } catch {
      const { createWorker, PSM } = await import("tesseract.js")
      const worker = await createWorker("eng")
      try {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN })
        const result = await worker.recognize(imagePath)
        return result.data.text
      } finally {
        await worker.terminate()
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** Minimal 24-bit BMP encoder for OCR input. */
function rgbToBmp(
  width: number,
  height: number,
  data: Uint8ClampedArray,
  channels: number
): Buffer {
  const rowSize = Math.floor((width * 3 + 3) / 4) * 4
  const pixelBytes = rowSize * height
  const fileSize = 54 + pixelBytes
  const buf = Buffer.alloc(fileSize)

  buf.write("BM", 0)
  buf.writeUInt32LE(fileSize, 2)
  buf.writeUInt32LE(0, 6)
  buf.writeUInt32LE(54, 10)
  buf.writeUInt32LE(40, 14)
  buf.writeInt32LE(width, 18)
  buf.writeInt32LE(height, 22)
  buf.writeUInt16LE(1, 26)
  buf.writeUInt16LE(24, 28)
  buf.writeUInt32LE(0, 30)
  buf.writeUInt32LE(pixelBytes, 34)

  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y
    const destRow = 54 + y * rowSize
    for (let x = 0; x < width; x++) {
      const src = (srcY * width + x) * channels
      const dest = destRow + x * 3
      const r = data[src] ?? 0
      const g = data[src + Math.min(1, channels - 1)] ?? r
      const b = data[src + Math.min(2, channels - 1)] ?? r
      buf[dest] = b
      buf[dest + 1] = g
      buf[dest + 2] = r
    }
  }

  return buf
}
