"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import { motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { SectionLabel } from "@/components/ui/section-label"
import { BIOMARKER_REGISTRY } from "@/lib/importers/blood-tests/BiomarkerMatcher"
import {
  applyBiomarkerSelection,
  createEmptyManualRow,
  type ManualBloodEntryRow,
} from "@/lib/importers/blood-tests/ManualBloodTestImporter"
import { formatShortDateWithYear } from "@/lib/health/analytics/series"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

interface ManualBloodEntryPanelProps {
  onBack?: () => void
  onSubmit: (rows: ManualBloodEntryRow[]) => void
}

function isRowComplete(row: ManualBloodEntryRow): boolean {
  const value = Number(String(row.value).replace(/,/g, "").trim())
  return Boolean(row.date.trim() && row.biomarker.trim() && Number.isFinite(value))
}

function displayValue(row: ManualBloodEntryRow): string {
  const raw = String(row.value).trim()
  if (!raw) return "—"
  return row.unit.trim() ? `${raw} ${row.unit.trim()}` : raw
}

export function ManualBloodEntryPanel({
  onBack,
  onSubmit,
}: ManualBloodEntryPanelProps) {
  const [rows, setRows] = useState<ManualBloodEntryRow[]>([
    createEmptyManualRow(),
  ])
  const [error, setError] = useState<string | null>(null)

  const completeCount = useMemo(
    () => rows.filter(isRowComplete).length,
    [rows]
  )

  const updateRow = (id: string, patch: Partial<ManualBloodEntryRow>) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    )
    setError(null)
  }

  const handleBiomarkerChange = (id: string, value: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? applyBiomarkerSelection(row, value) : row
      )
    )
    setError(null)
  }

  const handleSubmit = () => {
    const complete = rows.filter(isRowComplete)
    if (complete.length === 0) {
      setError("Add at least one marker with date, biomarker, and value.")
      return
    }
    onSubmit(complete)
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionLabel>Blood Markers</SectionLabel>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Enter each reading as it will appear on Mission Control — date,
            biomarker, and value.
          </p>
        </div>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Change source
          </button>
        ) : null}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transitions.fadeUp, delay: 0.04 }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {rows.map((row) => {
          const complete = isRowComplete(row)
          return (
            <div
              key={row.id}
              className={cn(
                "group relative rounded-2xl border border-border/50 bg-card/40 px-5 py-5 transition-colors",
                complete
                  ? "hover:border-primary/30 hover:bg-card/60"
                  : "border-dashed border-border/60"
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setRows((prev) =>
                    prev.length === 1
                      ? [createEmptyManualRow()]
                      : prev.filter((r) => r.id !== row.id)
                  )
                  setError(null)
                }}
                className="absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground"
                aria-label="Remove marker"
              >
                <Trash2 className="size-3.5" />
              </button>

              <div className="flex items-start justify-between gap-3 pr-6">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Biomarker</span>
                  <input
                    list="geoffit-biomarker-options"
                    placeholder="BIOMARKER"
                    value={row.biomarker}
                    onChange={(e) =>
                      handleBiomarkerChange(row.id, e.target.value)
                    }
                    className="w-full bg-transparent text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase outline-none placeholder:text-muted-foreground/40"
                  />
                </label>
                <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                  {complete ? "Ready" : "Unknown"}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-baseline gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Value</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={row.value}
                      onChange={(e) =>
                        updateRow(row.id, { value: e.target.value })
                      }
                      className="w-full bg-transparent text-xl font-medium tracking-tight text-foreground tabular-nums outline-none placeholder:text-muted-foreground/30"
                    />
                  </label>
                  <label className="w-[5.5rem] shrink-0">
                    <span className="sr-only">Unit</span>
                    <input
                      type="text"
                      placeholder="unit"
                      value={row.unit}
                      onChange={(e) =>
                        updateRow(row.id, { unit: e.target.value })
                      }
                      className="w-full bg-transparent text-right text-sm text-muted-foreground outline-none placeholder:text-muted-foreground/40"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="sr-only">Date</span>
                  <input
                    type="date"
                    value={row.date}
                    onChange={(e) =>
                      updateRow(row.id, { date: e.target.value })
                    }
                    className="w-full bg-transparent text-xs text-muted-foreground/70 outline-none [color-scheme:dark]"
                  />
                </label>

                <p className="text-xs text-muted-foreground/60">
                  {complete
                    ? `${displayValue(row)} · ${formatShortDateWithYear(row.date)}`
                    : "First reading"}
                </p>
              </div>
            </div>
          )
        })}

        <button
          type="button"
          onClick={() =>
            setRows((prev) => [...prev, createEmptyManualRow()])
          }
          className="flex min-h-[168px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/20 px-5 py-5 text-muted-foreground transition-colors hover:border-primary/30 hover:bg-card/40 hover:text-foreground"
        >
          <Plus className="size-5" />
          <span className="text-[11px] font-medium tracking-[0.14em] uppercase">
            Add marker
          </span>
        </button>
      </motion.div>

      <datalist id="geoffit-biomarker-options">
        {BIOMARKER_REGISTRY.map((marker) => (
          <option key={marker.key} value={marker.displayName} />
        ))}
      </datalist>

      {error ? (
        <p className="text-[13px] text-destructive">{error}</p>
      ) : null}

      <div className="flex flex-wrap gap-3 pt-2">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={completeCount === 0}
        >
          Confirm import
          {completeCount > 0 ? ` (${completeCount})` : ""}
        </Button>
        {onBack ? (
          <Button type="button" variant="outline" onClick={onBack}>
            Cancel
          </Button>
        ) : null}
      </div>
    </section>
  )
}
