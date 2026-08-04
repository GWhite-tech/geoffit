"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

import { SectionLabel } from "@/components/ui/section-label"
import {
  formatGrams,
  formatKcal,
  useNutritionSummary,
} from "@/lib/health/nutrition"
import { transitions } from "@/lib/theme"

export function NutritionSection() {
  const summary = useNutritionSummary("7d")
  const day = summary.today

  if (!day) return null

  return (
    <section className="space-y-6">
      <div>
        <SectionLabel>Nutrition</SectionLabel>
        <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
          Last 7 days — calories, protein, and target adherence.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transitions.fadeUp, delay: 0.04 }}
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        <div className="mc-card px-6 py-6">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/65 uppercase">
            Today
          </p>
          <p className="mt-4 text-[28px] leading-none font-medium tracking-tight text-foreground">
            {formatKcal(day.calories)}
          </p>
          <p className="mt-3 text-[13px] text-muted-foreground">
            {formatGrams(day.protein)} protein
          </p>
        </div>
        <div className="mc-card px-6 py-6">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/65 uppercase">
            Protein target
          </p>
          <p className="mt-4 text-[28px] leading-none font-medium tracking-tight text-foreground">
            {summary.proteinAchievement != null
              ? `${summary.proteinAchievement}%`
              : "—"}
          </p>
          <p className="mt-3 text-[13px] text-muted-foreground">
            {summary.proteinRemaining != null
              ? `${formatGrams(summary.proteinRemaining)} remaining`
              : "—"}
          </p>
        </div>
        <div className="mc-card px-6 py-6">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/65 uppercase">
            Calorie target
          </p>
          <p className="mt-4 text-[28px] leading-none font-medium tracking-tight text-foreground">
            {summary.calorieAchievement != null
              ? `${summary.calorieAchievement}%`
              : "—"}
          </p>
          <p className="mt-3 text-[13px] text-muted-foreground">
            {summary.caloriesRemaining != null
              ? summary.caloriesRemaining >= 0
                ? `${formatKcal(summary.caloriesRemaining)} left`
                : `${formatKcal(Math.abs(summary.caloriesRemaining))} over`
              : "—"}
          </p>
        </div>
      </motion.div>

      <div className="pt-1">
        <Link
          href="/nutrition"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary transition-colors hover:text-primary-hover"
        >
          Open nutrition analytics
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  )
}
