/**
 * Weekly Review export helpers — JSON, Markdown, print-to-PDF.
 */

import type { WeeklyReviewView } from "./types"

export function exportWeeklyReviewJson(view: WeeklyReviewView): string {
  return JSON.stringify(view, null, 2)
}

export function exportWeeklyReviewMarkdown(view: WeeklyReviewView): string {
  const lines: string[] = [
    `# ${view.bounds.label}`,
    view.bounds.rangeLabel,
    "",
    `Overall Health Score: ${view.score.score ?? "—"} (${
      view.score.change != null
        ? `${view.score.change > 0 ? "+" : ""}${view.score.change}`
        : "n/a"
    })`,
    "",
    view.headline,
    "",
    "## Biggest Wins",
    ...view.wins.map((win) => `- ${win.body}`),
    "",
    "## Training",
    ...view.training.narrative.map((line) => `- ${line}`),
    "",
    "## Recovery",
    ...view.recovery.narrative.map((line) => `- ${line}`),
    "",
    "## Nutrition",
    ...view.nutrition.narrative.map((line) => `- ${line}`),
    "",
    "## Health Story",
    ...view.story.map(
      (item) => `- ${item.body} _(${item.confidence} confidence)_`
    ),
    "",
    "## Focus for Next Week",
    ...view.focus.map((item) => `- **${item.body}** — ${item.why}`),
    "",
    "## Forecast",
    ...view.forecast.map(
      (item) => `- **${item.label}**: ${item.projection} _(${item.confidence})_`
    ),
    "",
    "## Coach's Note",
    view.coachNote,
    "",
  ]
  return lines.join("\n")
}

function downloadBlob(content: string, filename: string, type: string) {
  if (typeof window === "undefined") return
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadWeeklyReviewJson(view: WeeklyReviewView): void {
  downloadBlob(
    exportWeeklyReviewJson(view),
    `geoffit-weekly-review-${view.bounds.id}.json`,
    "application/json"
  )
}

export function downloadWeeklyReviewMarkdown(view: WeeklyReviewView): void {
  downloadBlob(
    exportWeeklyReviewMarkdown(view),
    `geoffit-weekly-review-${view.bounds.id}.md`,
    "text/markdown"
  )
}

/** Opens the browser print dialog — user can Save as PDF. */
export function printWeeklyReviewPdf(): void {
  if (typeof window === "undefined") return
  window.print()
}
