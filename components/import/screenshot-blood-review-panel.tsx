"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { BloodMarkerStatus } from "@/lib/domain/blood"
import {
  LOW_OCR_CONFIDENCE,
  rematchReviewRow,
  type ScreenshotImportDiagnostics,
  type ScreenshotReviewRow,
} from "@/lib/importers/blood-tests/ResultNormalizer"
import { cn } from "@/lib/utils"

const STATUS_OPTIONS: BloodMarkerStatus[] = [
  "normal",
  "high",
  "low",
  "critical",
  "review",
  "unknown",
]

interface ScreenshotBloodReviewPanelProps {
  fileName: string
  rows: ScreenshotReviewRow[]
  diagnostics: ScreenshotImportDiagnostics
  warnings: string[]
  onRowsChange: (rows: ScreenshotReviewRow[]) => void
  onConfirm: () => void
  onCancel: () => void
  isImporting?: boolean
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function ScreenshotBloodReviewPanel({
  fileName,
  rows,
  diagnostics,
  warnings,
  onRowsChange,
  onConfirm,
  onCancel,
  isImporting = false,
}: ScreenshotBloodReviewPanelProps) {
  const activeCount = rows.filter((row) => !row.excluded).length
  const canConfirm = activeCount > 0 && rows.some((row) => {
    if (row.excluded) return false
    const n = Number(String(row.value).replace(/,/g, "").trim())
    return Number.isFinite(n)
  })

  const updateRow = (id: string, patch: Partial<ScreenshotReviewRow>) => {
    onRowsChange(
      rows.map((row) => {
        if (row.id !== id) return row
        const next = { ...row, ...patch }
        if (patch.biomarker != null) {
          return rematchReviewRow(next)
        }
        return next
      })
    )
  }

  return (
    <div className="surface-functional p-8 lg:p-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Screenshot Review
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
            {fileName}
          </h2>
          <p className="mt-2 text-[15px] text-muted-foreground">
            Check OCR results, edit anything that looks wrong, then confirm.
          </p>
        </div>
        <Badge variant="secondary">Blood Screenshots</Badge>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <DiagStat label="Screens" value={String(diagnostics.screensProcessed)} />
        <DiagStat
          label="Biomarkers"
          value={String(diagnostics.biomarkersDetected)}
        />
        <DiagStat
          label="Unknown"
          value={String(diagnostics.unknownBiomarkers)}
        />
        <DiagStat
          label="Duplicates"
          value={String(diagnostics.duplicateResults)}
        />
        <DiagStat
          label="OCR confidence"
          value={formatConfidence(diagnostics.averageOcrConfidence)}
        />
      </div>

      {diagnostics.lowConfidenceCount > 0 ? (
        <p className="mt-4 text-[13px] text-warning/90">
          {diagnostics.lowConfidenceCount} row(s) have low OCR confidence and
          are highlighted — verify against the screenshot.
        </p>
      ) : null}

      {warnings.length > 0 ? (
        <div className="mt-4 space-y-1 rounded-lg bg-warning/5 px-4 py-3 text-[13px] text-warning/90">
          {warnings.slice(0, 8).map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      <div className="mt-8 overflow-x-auto rounded-lg border border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Biomarker</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Reference Range</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead className="w-[72px]">Keep</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const low = row.confidence < LOW_OCR_CONFIDENCE
              return (
                <TableRow
                  key={row.id}
                  className={cn(
                    row.excluded && "opacity-45",
                    low && !row.excluded && "bg-warning/5"
                  )}
                >
                  <TableCell>
                    <Input
                      value={row.date === "unknown" ? "" : row.date}
                      placeholder="YYYY-MM-DD"
                      onChange={(e) =>
                        updateRow(row.id, {
                          date: e.target.value.trim() || "unknown",
                        })
                      }
                      className="min-w-[8.5rem] font-mono text-[12px]"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.biomarker}
                      onChange={(e) =>
                        updateRow(row.id, { biomarker: e.target.value })
                      }
                      className={cn(
                        "min-w-[9rem]",
                        row.unknownBiomarker && "border-warning/50"
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.value}
                      inputMode="decimal"
                      onChange={(e) =>
                        updateRow(row.id, { value: e.target.value })
                      }
                      className="min-w-[5rem] tabular-nums"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.unit}
                      onChange={(e) =>
                        updateRow(row.id, { unit: e.target.value })
                      }
                      className="min-w-[5rem]"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.referenceRange}
                      onChange={(e) =>
                        updateRow(row.id, { referenceRange: e.target.value })
                      }
                      className="min-w-[6rem]"
                    />
                  </TableCell>
                  <TableCell>
                    <select
                      value={row.status}
                      onChange={(e) =>
                        updateRow(row.id, {
                          status: e.target.value as BloodMarkerStatus,
                        })
                      }
                      className="h-8 min-w-[6.5rem] rounded-lg border border-input bg-transparent px-2 text-[13px] outline-none"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "font-mono text-[12px] tabular-nums",
                        low ? "text-warning" : "text-muted-foreground"
                      )}
                    >
                      {formatConfidence(row.confidence)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={!row.excluded}
                      onChange={(e) =>
                        updateRow(row.id, { excluded: !e.target.checked })
                      }
                      aria-label={`Keep ${row.biomarker}`}
                      className="size-4 accent-primary"
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={onConfirm} disabled={isImporting || !canConfirm}>
          {isImporting
            ? "Importing…"
            : `Confirm import (${activeCount})`}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={isImporting}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function DiagStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-3">
      <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 font-mono text-[15px] tabular-nums text-foreground">
        {value}
      </p>
    </div>
  )
}
