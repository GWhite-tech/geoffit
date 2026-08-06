import type { PipelineStructuredLog } from "./types"

/** Structured Vercel-friendly logs — no /tmp dependency. */
export function logBloodPdfPipeline(
  event: string,
  payload: Record<string, unknown>
): void {
  console.info(
    JSON.stringify({
      scope: "blood-pdf-pipeline",
      event,
      ts: new Date().toISOString(),
      ...payload,
    })
  )
}

export function logStructuredExtractSummary(log: PipelineStructuredLog): void {
  logBloodPdfPipeline("extract_summary", {
    pageCount: log.pageCount,
    charsPerPage: log.charsPerPage,
    totalChars: log.totalChars,
    firstPagePreview: log.firstPagePreview.slice(0, 1000),
    biomarkerSignal: log.biomarkerSignal,
    parserDecision: log.parserDecision,
    stages: log.stages,
  })
}
