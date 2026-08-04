"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"

import { CalorieTrend } from "@/components/nutrition/calorie-trend"
import { DailyHistory } from "@/components/nutrition/daily-history"
import { MacroAdherence } from "@/components/nutrition/macro-adherence"
import { MacroBreakdown } from "@/components/nutrition/macro-breakdown"
import { NutritionContextSidebar } from "@/components/nutrition/nutrition-context-sidebar"
import { NutritionHero } from "@/components/nutrition/nutrition-hero"
import { NutritionInsights } from "@/components/nutrition/nutrition-insights"
import { NutritionNav } from "@/components/nutrition/nutrition-nav"
import type { NutritionRange } from "@/lib/health/nutrition"
import {
  useNutritionAnchor,
  useNutritionInsights,
  useNutritionSummary,
} from "@/lib/health/nutrition"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

const RANGES: { id: NutritionRange; label: string }[] = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "6m", label: "6M" },
  { id: "1y", label: "1Y" },
  { id: "all", label: "All" },
]

export function NutritionWorkspace() {
  const latest = useNutritionAnchor()
  const [range, setRange] = useState<NutritionRange>("30d")
  const [anchorDate, setAnchorDate] = useState<string | null>(null)
  const resolvedAnchor = anchorDate ?? latest
  const summary = useNutritionSummary(range, resolvedAnchor)
  const insights = useNutritionInsights(range)

  const dateOptions = useMemo(
    () => summary.history.map((day) => day.date).reverse(),
    [summary.history]
  )

  return (
    <div className="flex h-[calc(100svh-2.75rem)] w-full overflow-hidden">
      <div className="hidden h-full w-[280px] shrink-0 overflow-y-auto lg:block">
        <NutritionNav summary={summary} />
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitions.fadeUp}
          className="mx-auto flex w-full max-w-[1100px] flex-col gap-12 px-5 py-8 lg:px-10"
        >
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[34px] font-semibold tracking-tight text-foreground sm:text-[40px]">
                Nutrition
              </h1>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                Trends over time — calories, protein, and adherence. Not a food
                diary.
              </p>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:items-end">
              <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <span className="uppercase tracking-[0.12em]">Day</span>
                <input
                  type="date"
                  value={resolvedAnchor}
                  max={latest}
                  onChange={(event) => setAnchorDate(event.target.value)}
                  className="h-9 rounded-xl border border-border/40 bg-card/30 px-3 text-[13px] text-foreground outline-none"
                  list="nutrition-dates"
                />
                <datalist id="nutrition-dates">
                  {dateOptions.map((date) => (
                    <option key={date} value={date} />
                  ))}
                </datalist>
              </label>
              <div className="flex flex-wrap gap-0.5">
                {RANGES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRange(item.id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                      range === item.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <NutritionHero summary={summary} />
          <CalorieTrend chart={summary.chart} />
          <MacroBreakdown chart={summary.chart} />
          <MacroAdherence cards={summary.adherence} />
          <NutritionInsights insights={insights} />
          <DailyHistory history={summary.history} />
        </motion.div>
      </div>

      <div className="hidden h-full w-[280px] shrink-0 overflow-y-auto xl:block">
        <NutritionContextSidebar summary={summary} />
      </div>
    </div>
  )
}
