"use client"

import { Button } from "@/components/ui/button"
import type { AppleHealthProgressEvent } from "@/lib/importers/apple-health/progress"

interface ImportProgressPanelProps {
  progress: AppleHealthProgressEvent
  onCancelImport: () => void
  /** Compact progress for non–Apple Health importers (PDF OCR, etc.). */
  mode?: "apple-health" | "simple"
}

function formatEta(seconds: number | null): string {
  if (seconds === null) return "Calculating…"
  if (seconds <= 0) return "Almost done"
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`
  const minutes = Math.floor(seconds / 60)
  const rem = seconds % 60
  if (rem === 0) return `${minutes} minute${minutes === 1 ? "" : "s"}`
  return `${minutes}m ${rem}s`
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export function ImportProgressPanel({
  progress,
  onCancelImport,
  mode = "apple-health",
}: ImportProgressPanelProps) {
  const messageLines = progress.message.split("\n").filter(Boolean)

  if (mode === "simple") {
    return (
      <div className="surface-functional p-8 lg:p-9">
        <div className="space-y-1">
          {messageLines.map((line) => (
            <p key={line} className="text-[15px] font-medium text-foreground">
              {line}
            </p>
          ))}
        </div>

        <ProgressBar value={progress.progress} />

        <p className="mt-3 text-[13px] tabular-nums text-muted-foreground">
          {Math.round(progress.progress)}%
        </p>

        <div className="mt-8">
          <Button variant="outline" onClick={onCancelImport}>
            Cancel Import
          </Button>
        </div>
      </div>
    )
  }

  const topSkip = progress.reduction?.topSkipped[0]
  const reductionPct = progress.reduction?.estimatedReductionPercent

  return (
    <div className="surface-functional p-8 lg:p-9">
      <div className="space-y-1">
        {messageLines.map((line) => (
          <p key={line} className="text-[15px] font-medium text-foreground">
            {line}
          </p>
        ))}
      </div>

      <ProgressBar value={progress.progress} />

      <p className="mt-3 text-[13px] tabular-nums text-muted-foreground">
        {Math.round(progress.progress)}%
      </p>

      <p className="mt-5 text-[15px] tabular-nums text-foreground/85">
        {progress.processedElements.toLocaleString()} XML elements processed
      </p>

      {topSkip && reductionPct !== null && reductionPct !== undefined ? (
        <div className="mt-6 rounded-lg bg-muted/40 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground/90">Current import</p>
          <p className="mt-1 tabular-nums">
            {topSkip.count.toLocaleString()} {topSkip.label.toLowerCase()}{" "}
            records
          </p>
          <p className="mt-1">{topSkip.label} disabled</p>
          <p className="mt-2 text-foreground">
            Estimated import time reduced by {reductionPct}%
          </p>
        </div>
      ) : null}

      {progress.foundRecordTypes.length > 0 ? (
        <div className="mt-8">
          <p className="text-[13px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
            Found record types
          </p>
          <ul className="mt-3 space-y-1.5 font-mono text-[13px] tabular-nums text-foreground/90">
            {progress.foundRecordTypes.map((entry) => (
              <li key={entry.type} className="flex items-baseline gap-2">
                <span className="text-success">✓</span>
                <span className="min-w-0 flex-1 truncate">
                  {entry.label}
                  <span className="text-muted-foreground">
                    {" "}
                    ({entry.count.toLocaleString()})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-8">
        <p className="text-[13px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
          Searching for
        </p>
        <ul className="mt-3 space-y-1.5 font-mono text-[13px] tabular-nums text-foreground/90">
          {progress.searchingFor.map((entry) => (
            <li key={entry.key} className="flex items-baseline gap-2">
              <span className="text-muted-foreground">•</span>
              <span className="min-w-[9rem] text-muted-foreground">
                {entry.label}
              </span>
              <span className="flex-1 border-b border-dotted border-border/70" />
              <span
                className={
                  entry.found
                    ? "min-w-[4.5rem] text-right text-foreground"
                    : "min-w-[4.5rem] text-right text-muted-foreground"
                }
              >
                {entry.found ? entry.count.toLocaleString() : "—"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <p className="text-[13px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
          Estimated time remaining
        </p>
        <p className="mt-2 text-[17px] text-foreground">
          {formatEta(progress.estimatedRemainingTime)}
        </p>
      </div>

      <div className="mt-8">
        <Button variant="outline" onClick={onCancelImport}>
          Cancel Import
        </Button>
      </div>
    </div>
  )
}
