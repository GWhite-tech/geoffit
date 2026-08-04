"use client"

import { motion } from "framer-motion"

import type { NutritionSummary } from "@/lib/health/nutrition"
import {
  formatGrams,
  formatKcal,
  formatLitres,
} from "@/lib/health/nutrition"
import { transitions } from "@/lib/theme"

export function NutritionHero({ summary }: { summary: NutritionSummary }) {
  const day = summary.today

  if (!day) {
    return (
      <div className="mc-card px-6 py-8 text-[15px] text-muted-foreground">
        No nutrition data for this day. Import from Apple Health, MyFitnessPal,
        or another source to begin.
      </div>
    )
  }

  const metrics = [
    { label: "Calories", value: formatKcal(day.calories) },
    { label: "Protein", value: formatGrams(day.protein) },
    { label: "Carbs", value: formatGrams(day.carbohydrates) },
    { label: "Fat", value: formatGrams(day.fat) },
    { label: "Fibre", value: formatGrams(day.fibre) },
    { label: "Water", value: formatLitres(day.water) },
  ]

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitions.fadeUp}
      className="space-y-6"
    >
      <div>
        <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground/70 uppercase">
          Today&apos;s nutrition
        </p>
        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground/65 uppercase">
                {metric.label}
              </p>
              <p className="mt-2 text-[22px] leading-none font-medium tracking-tight text-foreground sm:text-[26px]">
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <RemainCard
          label="Calories remaining"
          value={
            summary.caloriesRemaining == null
              ? "—"
              : summary.caloriesRemaining >= 0
                ? formatKcal(summary.caloriesRemaining)
                : `${formatKcal(Math.abs(summary.caloriesRemaining))} over`
          }
        />
        <RemainCard
          label="Protein remaining"
          value={
            summary.proteinRemaining == null
              ? "—"
              : formatGrams(summary.proteinRemaining)
          }
        />
        <RemainCard
          label="Target achieved"
          value={
            summary.overallAchievement != null
              ? `${summary.overallAchievement}%`
              : "—"
          }
        />
      </div>
    </motion.section>
  )
}

function RemainCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="mc-card px-5 py-4">
      <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground/70 uppercase">
        {label}
      </p>
      <p className="mt-2 text-[18px] font-medium tracking-tight text-foreground">
        {value}
      </p>
    </div>
  )
}
