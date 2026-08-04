"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BloodManualEntryPanel } from "@/components/import/blood-manual-entry-panel"
import type { ImportPreview } from "@/lib/importers"
import type { ValidationResult } from "@/lib/importers"
import type { BloodManualEntryMarker } from "@/lib/importers/blood-tests/manual-entry"
import { isOcrGarbledWarning } from "@/lib/importers/blood-tests/apply-manual-entry"

interface ImportPreviewPanelProps {
  preview: ImportPreview
  validation: ValidationResult
  importerName: string
  onConfirm: () => void
  onCancel: () => void
  isImporting?: boolean
  manualEntryRequired?: BloodManualEntryMarker[]
  onApplyManualEntry?: (
    values: Record<string, { value: number; unit: string }>
  ) => void
  onSkipManualEntry?: () => void
}

function MappingFunnel({
  funnel,
}: {
  funnel: NonNullable<ImportPreview["mappingFunnel"]>
}) {
  if (funnel.length === 0) return null

  return (
    <div className="mt-8 space-y-5">
      <p className="text-[13px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
        Extraction funnel
      </p>
      <p className="text-[13px] text-muted-foreground">
        Detected → Mapped → Validated → Ready for Import
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {funnel.map((entry) => {
          const failed = entry.detected > 0 && entry.ready === 0
          return (
            <div
              key={entry.key}
              className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3"
            >
              <p className="text-[14px] font-medium text-foreground">
                {entry.label}
              </p>
              <dl className="mt-3 space-y-1 font-mono text-[12px] tabular-nums text-muted-foreground">
                <div className="flex justify-between gap-4">
                  <dt>Detected</dt>
                  <dd className="text-foreground">
                    {entry.detected.toLocaleString()}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Mapped</dt>
                  <dd className="text-foreground">
                    {entry.mapped.toLocaleString()}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Validated</dt>
                  <dd className="text-foreground">
                    {entry.validated.toLocaleString()}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Ready</dt>
                  <dd className="text-foreground">
                    {entry.ready.toLocaleString()}
                  </dd>
                </div>
              </dl>
              {failed && entry.primaryRejectReason ? (
                <p className="mt-3 text-[12px] leading-relaxed text-destructive">
                  Validation failed:
                  <br />
                  {entry.primaryRejectReason}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ImportPreviewPanel({
  preview,
  validation,
  importerName,
  onConfirm,
  onCancel,
  isImporting = false,
  manualEntryRequired = [],
  onApplyManualEntry,
  onSkipManualEntry,
}: ImportPreviewPanelProps) {
  const needsManualEntry = manualEntryRequired.length > 0
  const warningList = [...validation.warnings, ...preview.warnings].filter(
    (warning) => !(needsManualEntry && isOcrGarbledWarning(warning))
  )

  return (
    <div className="surface-functional p-8 lg:p-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Import Preview
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
            {preview.fileName}
          </h2>
          <p className="mt-2 text-[15px] text-muted-foreground">{preview.summary}</p>
        </div>
        <Badge variant="secondary">{importerName}</Badge>
      </div>

      <div className="mt-6 flex flex-wrap gap-4 text-[13px] text-muted-foreground">
        {preview.dateRange ? (
          <span>
            Date range: {preview.dateRange.start} → {preview.dateRange.end}
          </span>
        ) : null}
        {preview.duplicateCount !== undefined && preview.duplicateCount > 0 ? (
          <span>
            {preview.duplicateCount.toLocaleString()} duplicate(s) detected
          </span>
        ) : null}
        <span>{preview.recordCount.toLocaleString()} records</span>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {preview.categories.map((category) => (
          <Badge key={category} variant="outline">
            {category}
          </Badge>
        ))}
      </div>

      {preview.mappingFunnel ? (
        <MappingFunnel funnel={preview.mappingFunnel} />
      ) : null}

      {needsManualEntry && onApplyManualEntry && onSkipManualEntry ? (
        <BloodManualEntryPanel
          markers={manualEntryRequired}
          onApply={onApplyManualEntry}
          onSkip={onSkipManualEntry}
        />
      ) : null}

      {warningList.length > 0 && (
        <div className="mt-6 space-y-2 rounded-lg bg-warning/5 px-4 py-3 text-[13px] text-warning/90">
          {warningList.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

      {preview.rows.length > 0 ? (
        <div className="mt-8 overflow-hidden rounded-lg border border-border/50">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {preview.rows.some((row) => row.status)
                    ? "Status"
                    : "Category"}
                </TableHead>
                <TableHead>Metric</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.status ? (
                      <Badge
                        variant="outline"
                        className={
                          row.status === "high" ||
                          row.status === "low" ||
                          row.status === "critical"
                            ? "border-destructive/40 text-destructive"
                            : row.status === "normal"
                              ? "border-success/40 text-success"
                              : undefined
                        }
                      >
                        {row.category}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">
                        {row.category}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {row.value}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.date ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {preview.recordCount > preview.rows.length ? (
        <p className="mt-3 text-[13px] text-muted-foreground">
          Showing {preview.rows.length} of {preview.recordCount} records.
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <Button
          onClick={onConfirm}
          disabled={
            isImporting || preview.recordCount === 0 || needsManualEntry
          }
        >
          {isImporting
            ? "Importing…"
            : needsManualEntry
              ? "Resolve missing values to confirm"
              : `Confirm import (${preview.recordCount})`}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={isImporting}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
