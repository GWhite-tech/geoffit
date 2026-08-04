"use client"

import { useEffect, useState } from "react"

import { Input } from "@/components/ui/input"
import { SectionLabel } from "@/components/ui/section-label"
import type { Treatment } from "@/lib/domain/treatment"
import { getTreatmentStore, todayKey } from "@/lib/health/treatment"

export function TreatmentStartDate({ treatment }: { treatment: Treatment }) {
  const [value, setValue] = useState(treatment.startedAt ?? "")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setValue(treatment.startedAt ?? "")
  }, [treatment.id, treatment.startedAt])

  function commit() {
    if (!value) return
    if (value === treatment.startedAt) return
    getTreatmentStore().updateStartedAt(treatment.id, value)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1600)
  }

  return (
    <section className="space-y-4">
      <SectionLabel>Start date</SectionLabel>
      <div className="mc-card flex flex-wrap items-end gap-4 px-5 py-5">
        <label className="block space-y-2">
          <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
            Started
          </span>
          <Input
            type="date"
            value={value}
            max={todayKey()}
            onChange={(event) => {
              setValue(event.target.value)
              setSaved(false)
            }}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur()
              }
            }}
            className="h-11 w-[200px] border-border/40 bg-card/30"
          />
        </label>
        <p className="pb-2 text-[13px] text-muted-foreground">
          Used for adherence, Progress interventions, and “days on treatment”.
          {saved ? (
            <span className="ml-2 text-success">Saved</span>
          ) : null}
        </p>
      </div>
    </section>
  )
}
