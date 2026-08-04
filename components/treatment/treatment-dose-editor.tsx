"use client"

import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SectionLabel } from "@/components/ui/section-label"
import type { DoseSchedule, Treatment, WeekdayIndex } from "@/lib/domain/treatment"
import { WEEKDAY_SHORT } from "@/lib/domain/treatment"
import {
  enrichPeptideDose,
  formatUnits,
  getTreatmentStore,
  todayKey,
} from "@/lib/health/treatment"
import { cn } from "@/lib/utils"

type FrequencyPreset = "daily" | "twice_daily" | "weekdays" | "weekly" | "custom"

const PRESETS: { id: FrequencyPreset; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "twice_daily", label: "Twice daily" },
  { id: "weekdays", label: "Weekdays" },
  { id: "weekly", label: "Weekly" },
  { id: "custom", label: "Custom" },
]

const DEFAULT_TIMES = ["08:00", "20:00"] as const

function inferPreset(schedules: DoseSchedule[]): FrequencyPreset {
  if (schedules.length === 0) return "daily"
  const days = schedules[0]?.daysOfWeek ?? []
  const sameDays = schedules.every(
    (schedule) =>
      schedule.daysOfWeek.length === days.length &&
      schedule.daysOfWeek.every((day, index) => day === days[index])
  )
  if (!sameDays) return "custom"
  if (days.length === 0 && schedules.length === 2) return "twice_daily"
  if (days.length === 0) return "daily"
  if (
    days.length === 5 &&
    [0, 1, 2, 3, 4].every((day) => days.includes(day as WeekdayIndex))
  ) {
    return "weekdays"
  }
  if (days.length === 1) return "weekly"
  return "custom"
}

function daysForPreset(
  preset: FrequencyPreset,
  current: WeekdayIndex[]
): WeekdayIndex[] {
  if (preset === "daily" || preset === "twice_daily") return []
  if (preset === "weekdays") return [0, 1, 2, 3, 4]
  if (preset === "weekly") {
    return current.length === 1 ? current : [0]
  }
  return current
}

function timesForPreset(
  preset: FrequencyPreset,
  current: string[]
): string[] {
  if (preset === "twice_daily") {
    return [
      current[0] ?? DEFAULT_TIMES[0],
      current[1] ?? DEFAULT_TIMES[1],
    ]
  }
  if (preset === "daily" || preset === "weekdays" || preset === "weekly") {
    return [current[0] ?? DEFAULT_TIMES[0]]
  }
  return current.length > 0 ? current : [DEFAULT_TIMES[0]]
}

function buildSchedules(
  days: WeekdayIndex[],
  times: string[]
): DoseSchedule[] {
  const labels =
    times.length === 2
      ? ["Morning", "Evening"]
      : times.length > 2
        ? times.map((_, index) => `Dose ${index + 1}`)
        : [undefined]

  return times.map((time, index) => ({
    daysOfWeek: [...days],
    time,
    label: labels[index],
  }))
}

export function TreatmentDoseEditor({ treatment }: { treatment: Treatment }) {
  const [dose, setDose] = useState(String(treatment.currentDose))
  const [effectiveDate, setEffectiveDate] = useState(todayKey)
  const [preset, setPreset] = useState<FrequencyPreset>(() =>
    inferPreset(treatment.schedules)
  )
  const [days, setDays] = useState<WeekdayIndex[]>(() => {
    const inferred = inferPreset(treatment.schedules)
    const existing = treatment.schedules[0]?.daysOfWeek ?? []
    return daysForPreset(inferred, existing)
  })
  const [times, setTimes] = useState<string[]>(() =>
    timesForPreset(
      inferPreset(treatment.schedules),
      treatment.schedules.map((schedule) => schedule.time)
    )
  )
  const [saved, setSaved] = useState(false)

  const scheduleSyncKey = [
    treatment.id,
    treatment.currentDose,
    ...treatment.schedules.map(
      (schedule) =>
        `${schedule.time}:${schedule.daysOfWeek.join(",")}:${schedule.label ?? ""}`
    ),
  ].join("|")

  useEffect(() => {
    const nextPreset = inferPreset(treatment.schedules)
    setDose(String(treatment.currentDose))
    setPreset(nextPreset)
    setDays(
      daysForPreset(nextPreset, treatment.schedules[0]?.daysOfWeek ?? [])
    )
    setTimes(
      timesForPreset(
        nextPreset,
        treatment.schedules.map((schedule) => schedule.time)
      )
    )
  }, [scheduleSyncKey, treatment])

  const preview = useMemo(() => {
    const value = Number(dose)
    if (!Number.isFinite(value) || value <= 0) return null
    return enrichPeptideDose({ ...treatment, currentDose: value })
  }, [dose, treatment])

  const dirty = useMemo(() => {
    const value = Number(dose)
    if (!Number.isFinite(value)) return false
    const nextSchedules = buildSchedules(days, times)
    if (value !== treatment.currentDose) return true
    if (nextSchedules.length !== treatment.schedules.length) return true
    return nextSchedules.some((schedule, index) => {
      const current = treatment.schedules[index]
      if (!current) return true
      if (schedule.time !== current.time) return true
      if (schedule.daysOfWeek.length !== current.daysOfWeek.length) return true
      return schedule.daysOfWeek.some(
        (day, dayIndex) => day !== current.daysOfWeek[dayIndex]
      )
    })
  }, [dose, days, times, treatment])

  function applyPreset(next: FrequencyPreset) {
    setPreset(next)
    setDays(daysForPreset(next, days))
    setTimes(timesForPreset(next, times))
    setSaved(false)
  }

  function toggleDay(day: WeekdayIndex) {
    setPreset("custom")
    setDays((current) => {
      if (current.includes(day)) {
        const next = current.filter((value) => value !== day)
        return next
      }
      return [...current, day].sort((a, b) => a - b) as WeekdayIndex[]
    })
    setSaved(false)
  }

  function save() {
    const value = Number(dose)
    if (!Number.isFinite(value) || value <= 0) return
    if (preset === "custom" && days.length === 0) return
    if (preset === "weekly" && days.length !== 1) return

    const resolvedDays = daysForPreset(preset, days)
    const resolvedTimes = timesForPreset(preset, times).filter(Boolean)
    if (resolvedTimes.length === 0) return

    getTreatmentStore().updateDoseAndFrequency(treatment.id, {
      currentDose: value,
      schedules: buildSchedules(resolvedDays, resolvedTimes),
      dosesPerDay: resolvedTimes.length,
      effectiveDate: effectiveDate || todayKey(),
    })
    setSaved(true)
  }

  const showDayPicker = preset === "weekly" || preset === "custom"

  return (
    <section className="space-y-4">
      <SectionLabel>Dose & frequency</SectionLabel>
      <div className="mc-card space-y-6 px-5 py-5">
        <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
          <label className="block space-y-2">
            <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
              Current dose
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={dose}
                onChange={(event) => {
                  setDose(event.target.value)
                  setSaved(false)
                }}
                className="h-11 max-w-[160px] border-border/40 bg-card/30 text-[18px] font-medium tracking-tight"
              />
              <span className="text-[15px] text-muted-foreground">
                {treatment.doseUnit}
              </span>
            </div>
          </label>
          <label className="block space-y-2">
            <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
              Dose change date
            </span>
            <Input
              type="date"
              value={effectiveDate}
              max={todayKey()}
              onChange={(event) => {
                setEffectiveDate(event.target.value)
                setSaved(false)
              }}
              className="h-11 max-w-[200px] border-border/40 bg-card/30"
            />
          </label>
          {preview?.injectionUnits != null ? (
            <p className="text-[13px] text-muted-foreground sm:col-span-2">
              ≈ {formatUnits(preview.injectionUnits)}
              {preview.injectionVolumeMl != null
                ? ` · ${preview.injectionVolumeMl.toFixed(3)} ml`
                : ""}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
            Frequency
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => applyPreset(item.id)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors",
                  preset === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {showDayPicker ? (
          <div className="space-y-3">
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
              Days
            </p>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_SHORT.map((label, index) => {
                const day = index as WeekdayIndex
                const active = days.includes(day)
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      if (preset === "weekly") {
                        setDays([day])
                        setSaved(false)
                        return
                      }
                      toggleDay(day)
                    }}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                      active
                        ? "bg-primary/20 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
              Time{times.length > 1 ? "s" : ""}
            </p>
            {preset === "custom" ? (
              <button
                type="button"
                onClick={() => {
                  setTimes((current) => [...current, "12:00"])
                  setSaved(false)
                }}
                className="text-[12px] font-medium text-primary"
              >
                Add time
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            {times.map((time, index) => (
              <div key={`time-slot-${index}`} className="flex items-center gap-2">
                <Input
                  type="time"
                  value={time}
                  onChange={(event) => {
                    const value = event.target.value
                    setTimes((current) =>
                      current.map((entry, entryIndex) =>
                        entryIndex === index ? value : entry
                      )
                    )
                    setSaved(false)
                  }}
                  className="h-10 w-[140px] border-border/40 bg-card/30"
                />
                {preset === "custom" && times.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTimes((current) =>
                        current.filter((_, entryIndex) => entryIndex !== index)
                      )
                      setSaved(false)
                    }}
                    className="text-[12px] text-muted-foreground hover:text-foreground"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            type="button"
            onClick={save}
            disabled={!dirty}
            className="rounded-full px-5"
          >
            Save changes
          </Button>
          {saved ? (
            <span className="text-[13px] text-success">Saved</span>
          ) : dirty ? (
            <span className="text-[13px] text-muted-foreground">
              Unsaved changes
            </span>
          ) : null}
        </div>
      </div>
    </section>
  )
}
