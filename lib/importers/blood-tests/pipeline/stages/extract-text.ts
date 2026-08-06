import type { LoadedPdf } from "./pdf-loader"
import type {
  PageExtractionDiagnostics,
  StageResult,
  TextExtractionDiagnostics,
} from "../types"
import { logBloodPdfPipeline } from "../log"

function rawStrsFromItems(items: unknown[]): string[] {
  const strs: string[] = []
  for (const raw of items) {
    if (strs.length >= 20) break
    if (raw && typeof raw === "object" && "str" in raw) {
      strs.push(String((raw as { str?: string }).str ?? ""))
    }
  }
  return strs
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

/**
 * Stage: Text Extraction — every page getPage + getTextContent, timed.
 */
export async function runTextExtractionStage(
  loaded: LoadedPdf
): Promise<StageResult<TextExtractionDiagnostics, { text: string }>> {
  const started = performance.now()
  const pageCount = loaded.doc.numPages
  const pages: PageExtractionDiagnostics[] = []
  const nativePages: string[] = []
  const pdfJsWarnings = [...loaded.pdfJsWarnings]

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const pageStarted = performance.now()
    let getPageOk = false
    let getTextContentOk = false
    let itemCount = 0
    let charCount = 0
    let first1000Chars = ""
    let first20RawStrs: string[] = []
    let error: string | undefined

    try {
      const page = await loaded.doc.getPage(pageNum)
      getPageOk = true
      const content = await page.getTextContent({ includeMarkedContent: false })
      getTextContentOk = true
      const items = content.items ?? []
      itemCount = items.length
      first20RawStrs = rawStrsFromItems(items)
      const pageText = groupTextItems(items).join("\n")
      charCount = pageText.length
      first1000Chars = pageText.slice(0, 1000)
      nativePages.push(pageText)
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      nativePages.push("")
      pdfJsWarnings.push(`page ${pageNum}: ${error}`)
    }

    const pageDiag: PageExtractionDiagnostics = {
      pageNum,
      getPageOk,
      getTextContentOk,
      itemCount,
      charCount,
      durationMs: Math.round(performance.now() - pageStarted),
      first1000Chars,
      first20RawStrs,
      error,
    }
    pages.push(pageDiag)

    logBloodPdfPipeline("page_extract", {
      pageNum,
      getPageOk,
      getTextContentOk,
      itemCount,
      charCount,
      durationMs: pageDiag.durationMs,
      first1000Chars,
      first20RawStrs,
      error,
    })
  }

  const text = nativePages.join("\n\n")
  const charsPerPage = pages.map((p) => p.charCount)
  const totalChars = text.length
  const diagnostics: TextExtractionDiagnostics = {
    pageCount,
    charsPerPage,
    totalChars,
    firstPagePreview: pages[0]?.first1000Chars ?? "",
    pages,
    pdfJsWarnings,
  }

  logBloodPdfPipeline("text_extraction_done", {
    pageCount,
    charsPerPage,
    totalChars,
    firstPagePreview: diagnostics.firstPagePreview,
    pagesExtracted: pages.length,
  })

  const allPagesOk = pages.every((p) => p.getPageOk && p.getTextContentOk)
  return {
    stage: "text_extraction",
    status: allPagesOk ? "ok" : pages.some((p) => p.getPageOk) ? "ok" : "failed",
    durationMs: Math.round(performance.now() - started),
    diagnostics,
    data: { text },
    error: allPagesOk
      ? undefined
      : pages.find((p) => p.error)?.error ?? "PDF text extraction failed.",
  }
}
