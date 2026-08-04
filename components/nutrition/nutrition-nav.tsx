"use client"

import { motion } from "framer-motion"

import type { NutritionSummary } from "@/lib/health/nutrition"
import {
  formatGrams,
  formatKcal,
  formatLitres,
} from "@/lib/health/nutrition"
import { transitions } from "@/lib/theme"

export function NutritionNav({ summary }: { summary: NutritionSummary }) {
  const day = summary.today

  const items = [
    {
      label: "Calories",
      value: day ? formatKcal(day.calories) : "—",
      detail:
        summary.caloriesRemaining != null
          ? summary.caloriesRemaining >= 0
            ? `${Math.round(summary.caloriesRemaining)} left`
            : "Over target"
          : null,
    },
    {
      label: "Protein",
      value: day ? formatGrams(day.protein) : "—",
      detail:
        summary.proteinAchievement != null
          ? `${summary.proteinAchievement}% of target`
          : null,
    },
    {
      label: "Carbs",
      value: day ? formatGrams(day.carbohydrates) : "—",
      detail: null,
    },
    {
      label: "Fat",
      value: day ? formatGrams(day.fat) : "—",
      detail: null,
    },
    {
      label: "Fibre",
      value: day ? formatGrams(day.fibre) : "—",
      detail: null,
    },
    {
      label: "Water",
      value: day ? formatLitres(day.water) : "—",
      detail: null,
    },
  ]

  return (
    <aside className="flex h-full w-full flex-col border-r border-border/30 px-5 pt-8 pb-8">
      <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground/70 uppercase">
        Today&apos;s summary
      </p>
      <p className="mt-2 text-[13px] text-muted-foreground">
        {summary.anchorDate}
      </p>

      <ul className="mt-6 space-y-2">
        {items.map((item, index) => (
          <motion.li
            key={item.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transitions.fadeUp, delay: index * 0.03 }}
            className="rounded-xl px-3 py-3 transition-colors hover:bg-card/35"
          >
            <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground/70 uppercase">
              {item.label}
            </p>
            <p className="mt-1.5 text-[16px] font-medium tracking-tight text-foreground">
              {item.value}
            </p>
            {item.detail ? (
              <p className="mt-1 text-[12px] text-muted-foreground">
                {item.detail}
              </p>
            ) : null}
          </motion.li>
        ))}
      </ul>
    </aside>
  )
}
