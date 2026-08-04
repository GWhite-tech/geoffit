"use client"

import { motion } from "framer-motion"

import { SleepMetricTile } from "@/components/sleep/sleep-metric-tile"
import { SectionLabel } from "@/components/ui/section-label"
import type { SleepSummary } from "@/lib/health/sleep"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function SleepOverview({ overview }: { overview: SleepSummary["overview"] }) {
  return (
    <section className="space-y-6">
      <SectionLabel>Sleep Overview</SectionLabel>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.fadeUp}
        className="rounded-3xl border border-border/40 bg-gradient-to-br from-primary/[0.08] via-card/30 to-transparent px-8 py-10 sm:px-10 sm:py-12"
      >
        <p className="text-[13px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
          Last night&apos;s sleep
        </p>
        <p
          className={cn(
            "mt-3 font-medium tracking-tight text-foreground",
            overview.lastNight.available
              ? "text-5xl sm:text-6xl lg:text-7xl"
              : "text-3xl text-muted-foreground sm:text-4xl"
          )}
        >
          {overview.lastNight.display}
        </p>
        {overview.versusWeeklyAverage ? (
          <p className="mt-4 text-base text-muted-foreground">
            {overview.versusWeeklyAverage}
          </p>
        ) : !overview.lastNight.available ? (
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground/70">
            {overview.lastNight.reason}
          </p>
        ) : null}
      </motion.div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SleepMetricTile label="Sleep Score" metric={overview.sleepScore} />
        <SleepMetricTile label="Time in Bed" metric={overview.timeInBed} />
        <SleepMetricTile label="Sleep Efficiency" metric={overview.sleepEfficiency} />
        <SleepMetricTile label="Consistency" metric={overview.consistency} />
      </div>
    </section>
  )
}
