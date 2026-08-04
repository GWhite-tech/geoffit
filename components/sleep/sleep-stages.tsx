"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { SleepStageSegment, SleepSummary } from "@/lib/health/sleep"
import { formatDurationMinutes } from "@/lib/health/types"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

const STAGE_COLOURS: Record<string, string> = {
  deep: "bg-indigo-400/90",
  core: "bg-violet-400/80",
  rem: "bg-fuchsia-400/75",
  awake: "bg-amber-300/70",
  unspecified: "bg-violet-300/50",
  asleep: "bg-violet-400/70",
}

function formatRange(iso: string): string {
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return "—"
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(time))
}

function StageBar({ segments }: { segments: SleepStageSegment[] }) {
  const total = segments.reduce(
    (sum, s) => sum + Math.max(s.durationMinutes, 0.5),
    0
  )
  if (total <= 0) return null

  return (
    <div className="flex h-14 w-full overflow-hidden rounded-2xl bg-muted/30 ring-1 ring-border/40">
      {segments.map((segment) => {
        const width = (Math.max(segment.durationMinutes, 0.5) / total) * 100
        return (
          <Tooltip key={segment.id}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className={cn(
                    "h-full min-w-[3px] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    STAGE_COLOURS[segment.kind] ?? "bg-muted"
                  )}
                  style={{ width: `${width}%` }}
                  aria-label={`${segment.label} ${formatDurationMinutes(segment.durationMinutes)}`}
                />
              }
            />
            <TooltipContent side="top" className="flex-col items-start gap-1 px-3 py-2">
              <p className="font-medium">{segment.label}</p>
              <p>
                {formatRange(segment.startDate)} → {formatRange(segment.endDate)}
              </p>
              <p>{formatDurationMinutes(segment.durationMinutes)}</p>
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

export function SleepStages({ stages }: { stages: SleepSummary["stages"] }) {
  const totals = [
    { id: "deep", label: "Deep", metric: stages.totals.deep, swatch: "bg-indigo-400" },
    { id: "rem", label: "REM", metric: stages.totals.rem, swatch: "bg-fuchsia-400" },
    { id: "core", label: "Core", metric: stages.totals.core, swatch: "bg-violet-400" },
    { id: "awake", label: "Awake", metric: stages.totals.awake, swatch: "bg-amber-300" },
  ]

  return (
    <section className="space-y-6">
      <SectionLabel>Sleep Stages</SectionLabel>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transitions.fadeUp, delay: 0.05 }}
        className="space-y-8 rounded-3xl border border-border/40 bg-card/25 px-6 py-8 sm:px-8"
      >
        {stages.segments.length > 0 ? (
          <div>
            <StageBar segments={stages.segments} />
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              {totals.map((item) => (
                <span key={item.id} className="inline-flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", item.swatch)} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {stages.emptyHint ?? "Sleep stage timeline unavailable."}
          </p>
        )}

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {totals.map((item) => (
            <div key={item.id}>
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", item.swatch)} />
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
                  {item.label}
                </p>
              </div>
              <p
                className={cn(
                  "mt-2 text-xl font-medium tracking-tight",
                  item.metric.available
                    ? "text-foreground"
                    : "text-muted-foreground/70"
                )}
              >
                {item.metric.display}
              </p>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
