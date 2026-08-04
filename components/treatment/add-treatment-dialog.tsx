"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { TreatmentCategory, WeekdayIndex } from "@/lib/domain/treatment"
import { TREATMENT_CATEGORY_LABELS, WEEKDAY_SHORT } from "@/lib/domain/treatment"
import { getTreatmentStore, todayKey } from "@/lib/health/treatment"
import { cn } from "@/lib/utils"

const CATEGORIES: TreatmentCategory[] = [
  "prescription",
  "peptide",
  "supplement",
  "injectable",
]

type FrequencyPreset = "daily" | "twice_daily" | "weekdays" | "weekly"

const FREQUENCIES: { id: FrequencyPreset; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "twice_daily", label: "Twice daily" },
  { id: "weekdays", label: "Weekdays" },
  { id: "weekly", label: "Weekly" },
]

function defaultUnit(category: TreatmentCategory): string {
  if (category === "supplement") return "IU"
  return "mg"
}

function daysForPreset(preset: FrequencyPreset, weeklyDay: WeekdayIndex): WeekdayIndex[] {
  if (preset === "daily" || preset === "twice_daily") return []
  if (preset === "weekdays") return [0, 1, 2, 3, 4]
  return [weeklyDay]
}

function timesForPreset(preset: FrequencyPreset, time: string): string[] {
  if (preset === "twice_daily") return [time || "08:00", "20:00"]
  return [time || "08:00"]
}

export function AddTreatmentDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [category, setCategory] = useState<TreatmentCategory>("prescription")
  const [name, setName] = useState("")
  const [dose, setDose] = useState("")
  const [unit, setUnit] = useState("mg")
  const [frequency, setFrequency] = useState<FrequencyPreset>("daily")
  const [time, setTime] = useState("08:00")
  const [weeklyDay, setWeeklyDay] = useState<WeekdayIndex>(0)
  const [tablets, setTablets] = useState("")
  const [vialMg, setVialMg] = useState("10")
  const [bacMl, setBacMl] = useState("2")
  const [startedAt, setStartedAt] = useState(todayKey)
  const [error, setError] = useState<string | null>(null)

  const isPeptide = category === "peptide" || category === "injectable"
  const isOral = category === "prescription" || category === "supplement"

  const canSubmit = useMemo(() => {
    const doseValue = Number(dose)
    return name.trim().length > 0 && Number.isFinite(doseValue) && doseValue > 0
  }, [name, dose])

  function resetForm(nextCategory: TreatmentCategory = "prescription") {
    setCategory(nextCategory)
    setName("")
    setDose("")
    setUnit(defaultUnit(nextCategory))
    setFrequency(nextCategory === "peptide" ? "weekly" : "daily")
    setTime(nextCategory === "peptide" ? "19:00" : "08:00")
    setWeeklyDay(0)
    setTablets("")
    setVialMg("10")
    setBacMl("2")
    setStartedAt(todayKey())
    setError(null)
  }

  function handleCategory(next: TreatmentCategory) {
    setCategory(next)
    setUnit(defaultUnit(next))
    if (next === "peptide" || next === "injectable") {
      setFrequency("weekly")
      setTime("19:00")
    } else {
      setFrequency("daily")
      setTime("08:00")
    }
    setError(null)
  }

  function submit() {
    const doseValue = Number(dose)
    if (!name.trim()) {
      setError("Enter a name.")
      return
    }
    if (!(doseValue > 0)) {
      setError("Enter a valid dose.")
      return
    }

    try {
      const created = getTreatmentStore().createTreatment({
        name: name.trim(),
        category,
        currentDose: doseValue,
        doseUnit: unit.trim() || defaultUnit(category),
        startedAt: startedAt || todayKey(),
        daysOfWeek: daysForPreset(frequency, weeklyDay),
        times: timesForPreset(frequency, time),
        tabletsRemaining: isOral && tablets ? Number(tablets) : undefined,
        vialStrengthMg: isPeptide ? Number(vialMg) : undefined,
        bacWaterMl: isPeptide ? Number(bacMl) : undefined,
      })
      onOpenChange(false)
      resetForm(category)
      router.push(`/treatment/${created.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create treatment.")
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) resetForm(category)
      }}
    >
      <DialogContent
        className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="text-[20px] tracking-tight">
            Add treatment
          </DialogTitle>
          <DialogDescription>
            Create a prescription, peptide, supplement, or injectable. You can
            refine dose and reconstitution after.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          <div className="space-y-2">
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
              Type
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleCategory(item)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors",
                    category === item
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {TREATMENT_CATEGORY_LABELS[item]}
                </button>
              ))}
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
              Name
            </span>
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError(null)
              }}
              placeholder={
                category === "peptide"
                  ? "e.g. Retatrutide"
                  : category === "supplement"
                    ? "e.g. Omega-3"
                    : "e.g. Metformin"
              }
              className="h-11 border-border/40 bg-card/30"
            />
          </label>

          <div className="grid grid-cols-[1fr_100px] gap-3">
            <label className="block space-y-2">
              <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
                Dose
              </span>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={dose}
                onChange={(event) => {
                  setDose(event.target.value)
                  setError(null)
                }}
                className="h-11 border-border/40 bg-card/30"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
                Unit
              </span>
              <Input
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                className="h-11 border-border/40 bg-card/30"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
              Start date
            </span>
            <Input
              type="date"
              value={startedAt}
              max={todayKey()}
              onChange={(event) => setStartedAt(event.target.value)}
              className="h-11 max-w-[220px] border-border/40 bg-card/30"
            />
          </label>

          <div className="space-y-3">
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
              Frequency
            </p>
            <div className="flex flex-wrap gap-1.5">
              {FREQUENCIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFrequency(item.id)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors",
                    frequency === item.id
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="h-10 w-[140px] border-border/40 bg-card/30"
              />
              {frequency === "weekly" ? (
                <div className="flex flex-wrap gap-1">
                  {WEEKDAY_SHORT.map((label, index) => {
                    const day = index as WeekdayIndex
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setWeeklyDay(day)}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                          weeklyDay === day
                            ? "bg-primary/20 text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </div>

          {isOral ? (
            <label className="block space-y-2">
              <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
                Tablets remaining
              </span>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={tablets}
                onChange={(event) => setTablets(event.target.value)}
                placeholder="Optional"
                className="h-11 max-w-[200px] border-border/40 bg-card/30"
              />
            </label>
          ) : null}

          {isPeptide ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-2">
                <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
                  Vial size
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={vialMg}
                    onChange={(event) => setVialMg(event.target.value)}
                    className="h-11 border-border/40 bg-card/30"
                  />
                  <span className="text-[13px] text-muted-foreground">mg</span>
                </div>
              </label>
              <label className="block space-y-2">
                <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
                  Bac water
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={bacMl}
                    onChange={(event) => setBacMl(event.target.value)}
                    className="h-11 border-border/40 bg-card/30"
                  />
                  <span className="text-[13px] text-muted-foreground">ml</span>
                </div>
              </label>
            </div>
          ) : null}

          {error ? (
            <p className="text-[13px] text-destructive">{error}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="rounded-full px-5"
            >
              Add treatment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function AddTreatmentButton({
  className,
  label = "Add",
}: {
  className?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        className={cn("rounded-full text-primary hover:text-primary", className)}
      >
        <Plus className="size-3.5" />
        {label}
      </Button>
      <AddTreatmentDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
