"use client"

import Link from "next/link"
import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import { WEEKDAY_SHORT } from "@/lib/domain/treatment"
import {
  getTreatmentStore,
  useWeeklyPlanner,
  type PlannerCell,
} from "@/lib/health/treatment"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

function formatDayHeader(date: string, index: number, today: string): string {
  const day = Number(date.slice(8, 10))
  return `${WEEKDAY_SHORT[index]} ${day}`
}

function formatTime(time: string | null): string {
  if (!time) return ""
  const [h, m] = time.split(":").map(Number)
  if (h == null || m == null) return time
  const hour = h % 12 || 12
  const suffix = h >= 12 ? "PM" : "AM"
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`
}

function DoseCell({
  cell,
  onToggle,
}: {
  cell: PlannerCell
  onToggle: () => void
}) {
  if (cell.state === "empty") {
    return (
      <div className="flex min-h-[88px] items-center justify-center rounded-xl bg-transparent" />
    )
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex min-h-[88px] w-full flex-col items-start justify-between rounded-xl px-3 py-3 text-left transition-colors",
        cell.state === "taken" && "bg-primary/18 hover:bg-primary/24",
        cell.state === "scheduled" && "bg-card/45 hover:bg-card/60",
        cell.state === "missed" && "bg-destructive/10 hover:bg-destructive/15",
        cell.state === "skipped" && "bg-card/25 hover:bg-card/35"
      )}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className="text-[13px] font-medium tracking-tight text-foreground">
          {cell.doseLabel}
        </span>
        <span
          className={cn(
            "mt-0.5 size-2 shrink-0 rounded-full",
            cell.state === "taken" && "bg-primary",
            cell.state === "scheduled" && "bg-muted-foreground/35",
            cell.state === "missed" && "bg-destructive/80",
            cell.state === "skipped" && "bg-muted-foreground/25"
          )}
        />
      </div>
      <div className="space-y-0.5">
        {cell.unitsLabel ? (
          <p className="text-[11px] text-muted-foreground">{cell.unitsLabel}</p>
        ) : null}
        <p className="text-[11px] text-muted-foreground/80">
          {formatTime(cell.time)}
        </p>
      </div>
    </button>
  )
}

export function WeeklyPlanner() {
  const { dates, today, rows } = useWeeklyPlanner()

  function toggle(cell: PlannerCell) {
    if (cell.state === "empty") return
    getTreatmentStore().toggleDoseTaken(
      cell.treatmentId,
      cell.date,
      cell.time ?? undefined
    )
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>Weekly planner</SectionLabel>
          <h2 className="mt-3 text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
            Treatment week
          </h2>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            Tap a cell to log a dose. Missed days mark themselves after the day
            passes.
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.fadeUp}
        className="mc-surface-hero overflow-x-auto px-3 py-4 sm:px-5 sm:py-6"
      >
        <div
          className="grid min-w-[860px] gap-2"
          style={{
            gridTemplateColumns: "160px repeat(7, minmax(96px, 1fr))",
          }}
        >
          <div />
          {dates.map((date, index) => {
            const isToday = date === today
            return (
              <div
                key={date}
                className={cn(
                  "px-2 py-2 text-center text-[12px] font-medium tracking-[0.04em]",
                  isToday ? "text-primary" : "text-muted-foreground"
                )}
              >
                {formatDayHeader(date, index, today)}
              </div>
            )
          })}

          {rows.map((row) => (
            <div key={row.treatment.id} className="contents">
              <div className="flex flex-col justify-center px-2 py-2">
                <Link
                  href={`/treatment/${row.treatment.id}`}
                  className="text-[13px] font-medium text-foreground transition-colors hover:text-primary"
                >
                  {row.treatment.shortName}
                </Link>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {row.treatment.category === "peptide"
                    ? "Peptide"
                    : row.treatment.category === "prescription"
                      ? "Prescription"
                      : "Supplement"}
                </p>
              </div>
              {row.cells.map((cell) => (
                <DoseCell
                  key={`${cell.treatmentId}-${cell.date}`}
                  cell={cell}
                  onToggle={() => toggle(cell)}
                />
              ))}
            </div>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="px-2 py-8 text-[15px] text-muted-foreground">
            Add an active treatment to populate your weekly planner.
          </p>
        ) : null}
      </motion.div>

      <div className="flex flex-wrap gap-4 text-[12px] text-muted-foreground">
        <Legend swatch="bg-primary/18" label="Taken" />
        <Legend swatch="bg-card/45" label="Scheduled" />
        <Legend swatch="bg-destructive/10" label="Missed" />
      </div>
    </section>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("size-3 rounded-md", swatch)} />
      {label}
    </span>
  )
}
