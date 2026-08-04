"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SectionLabel } from "@/components/ui/section-label"
import type { DoseEvent, Treatment } from "@/lib/domain/treatment"
import { DOSE_EVENT_LABELS } from "@/lib/domain/treatment"
import {
  formatDose,
  getTreatmentStore,
  todayKey,
} from "@/lib/health/treatment"
import { cn } from "@/lib/utils"

export function TreatmentDoseHistory({
  treatment,
  events,
}: {
  treatment: Treatment
  events: DoseEvent[]
}) {
  const history = useMemo(
    () =>
      events
        .filter(
          (event) => event.kind === "increased" || event.kind === "reduced"
        )
        .sort((a, b) => {
          const byDate = b.date.localeCompare(a.date)
          if (byDate !== 0) return byDate
          return b.recordedAt.localeCompare(a.recordedAt)
        }),
    [events]
  )

  const inferredPrevious = useMemo(() => {
    const prior = history[0]
    return prior?.dose ?? treatment.currentDose
  }, [history, treatment.currentDose])

  const [effectiveDate, setEffectiveDate] = useState(todayKey)
  const [newDose, setNewDose] = useState("")
  const [previousDose, setPreviousDose] = useState(String(inferredPrevious))
  const [notes, setNotes] = useState("")
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function syncPreviousFromHistory() {
    setPreviousDose(String(inferredPrevious))
  }

  function submit() {
    const next = Number(newDose)
    const previous = Number(previousDose)
    if (!Number.isFinite(next) || next <= 0) {
      setError("Enter a valid new dose.")
      return
    }
    if (!Number.isFinite(previous) || previous < 0) {
      setError("Enter the previous dose.")
      return
    }
    if (next === previous) {
      setError("New dose must differ from the previous dose.")
      return
    }
    if (!effectiveDate) {
      setError("Enter an effective date.")
      return
    }

    getTreatmentStore().logDoseChange(treatment.id, {
      dose: next,
      effectiveDate,
      previousDose: previous,
      notes: notes.trim() || undefined,
    })

    setNewDose("")
    setNotes("")
    setSaved(true)
    setError(null)
    setPreviousDose(String(next))
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <section className="space-y-4">
      <SectionLabel>Dose changes</SectionLabel>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Log dosage changes over time — including historical increases and
        reductions. Progress and the coach use these dates as interventions.
      </p>

      <div className="mc-card space-y-5 px-5 py-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
              Effective date
            </span>
            <Input
              type="date"
              value={effectiveDate}
              max={todayKey()}
              onChange={(event) => {
                setEffectiveDate(event.target.value)
                setSaved(false)
                setError(null)
              }}
              className="h-11 border-border/40 bg-card/30"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
              Previous dose
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={previousDose}
                onChange={(event) => {
                  setPreviousDose(event.target.value)
                  setSaved(false)
                  setError(null)
                }}
                onFocus={syncPreviousFromHistory}
                className="h-11 border-border/40 bg-card/30"
              />
              <span className="shrink-0 text-[13px] text-muted-foreground">
                {treatment.doseUnit}
              </span>
            </div>
          </label>
          <label className="block space-y-2">
            <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
              New dose
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={newDose}
                onChange={(event) => {
                  setNewDose(event.target.value)
                  setSaved(false)
                  setError(null)
                }}
                className="h-11 border-border/40 bg-card/30"
              />
              <span className="shrink-0 text-[13px] text-muted-foreground">
                {treatment.doseUnit}
              </span>
            </div>
          </label>
          <label className="block space-y-2">
            <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
              Notes
            </span>
            <Input
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value)
                setSaved(false)
              }}
              placeholder="Optional"
              className="h-11 border-border/40 bg-card/30"
            />
          </label>
        </div>

        {error ? (
          <p className="text-[13px] text-destructive">{error}</p>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="button" onClick={submit}>
            Log dose change
          </Button>
          {saved ? (
            <span className="text-[13px] text-success">Saved</span>
          ) : null}
        </div>
      </div>

      {history.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">
          No dose changes logged yet.
        </p>
      ) : (
        <ol className="relative space-y-0 border-l border-border/40 pl-5">
          {history.map((event) => (
            <li key={event.id} className="relative pb-5 last:pb-0">
              <span
                className={cn(
                  "absolute top-1.5 -left-[1.55rem] size-2.5 rounded-full",
                  event.kind === "increased" ? "bg-primary" : "bg-warning"
                )}
              />
              <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                {event.date}
              </p>
              <p className="mt-1 text-[15px] font-medium text-foreground">
                {DOSE_EVENT_LABELS[event.kind]}
                {event.dose != null
                  ? ` · ${formatDose(event.dose, event.doseUnit ?? treatment.doseUnit)}`
                  : ""}
              </p>
              {event.notes ? (
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {event.notes}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
