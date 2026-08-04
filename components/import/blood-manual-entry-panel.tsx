"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { BloodManualEntryMarker } from "@/lib/importers/blood-tests/manual-entry"

export type ManualEntryDraft = Record<string, string>

interface BloodManualEntryPanelProps {
  markers: BloodManualEntryMarker[]
  onApply: (values: Record<string, { value: number; unit: string }>) => void
  onSkip: () => void
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, "")
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function BloodManualEntryPanel({
  markers,
  onApply,
  onSkip,
}: BloodManualEntryPanelProps) {
  const [drafts, setDrafts] = useState<ManualEntryDraft>(() =>
    Object.fromEntries(markers.map((m) => [m.key, ""]))
  )
  const [units, setUnits] = useState<Record<string, string>>(() =>
    Object.fromEntries(markers.map((m) => [m.key, m.unit]))
  )
  const [error, setError] = useState<string | null>(null)

  const allFilled = markers.every((m) => parseNumber(drafts[m.key] ?? "") !== null)

  const handleApply = () => {
    const values: Record<string, { value: number; unit: string }> = {}
    for (const marker of markers) {
      const parsed = parseNumber(drafts[marker.key] ?? "")
      if (parsed === null) {
        setError(`Enter a value for ${marker.name}, or skip remaining markers.`)
        return
      }
      values[marker.key] = {
        value: parsed,
        unit: (units[marker.key] ?? marker.unit).trim() || marker.unit,
      }
    }
    setError(null)
    onApply(values)
  }

  return (
    <div className="mt-6 space-y-4 rounded-lg border border-warning/30 bg-warning/5 px-4 py-4">
      <div>
        <p className="text-[14px] font-medium text-foreground">
          Enter values OCR could not read
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          Check the PDF and type the number below. Units are pre-filled when
          known.
        </p>
      </div>

      <ul className="space-y-4">
        {markers.map((marker) => (
          <li
            key={marker.key}
            className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.6fr)] sm:items-end"
          >
            <div>
              <p className="text-[14px] font-medium text-foreground">
                {marker.name}
              </p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {marker.referenceRange.text !== "—"
                  ? `Ref ${marker.referenceRange.text}`
                  : "Reference range unavailable"}
                {marker.status !== "unknown" ? ` · ${marker.status}` : ""}
              </p>
            </div>
            <label className="block space-y-1.5">
              <span className="text-[12px] text-muted-foreground">Value</span>
              <Input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="e.g. 18.4"
                value={drafts[marker.key] ?? ""}
                onChange={(e) => {
                  setDrafts((prev) => ({
                    ...prev,
                    [marker.key]: e.target.value,
                  }))
                  setError(null)
                }}
                className="tabular-nums"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[12px] text-muted-foreground">Unit</span>
              <Input
                type="text"
                autoComplete="off"
                value={units[marker.key] ?? marker.unit}
                onChange={(e) => {
                  setUnits((prev) => ({
                    ...prev,
                    [marker.key]: e.target.value,
                  }))
                }}
              />
            </label>
          </li>
        ))}
      </ul>

      {error ? (
        <p className="text-[13px] text-destructive">{error}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={handleApply} disabled={!allFilled}>
          Apply values
        </Button>
        <Button type="button" variant="outline" onClick={onSkip}>
          Skip and continue without these
        </Button>
      </div>
    </div>
  )
}
