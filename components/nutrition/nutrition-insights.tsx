"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import type { NutritionInsight } from "@/lib/health/nutrition"
import { transitions } from "@/lib/theme"

export function NutritionInsights({
  insights,
}: {
  insights: NutritionInsight[]
}) {
  return (
    <section className="space-y-4">
      <SectionLabel>Insights</SectionLabel>
      <ul className="space-y-2.5">
        {insights.map((insight, index) => (
          <motion.li
            key={insight.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transitions.fadeUp, delay: 0.04 + index * 0.03 }}
            className="mc-card px-5 py-4 text-[15px] leading-relaxed text-foreground/90"
          >
            {insight.body}
          </motion.li>
        ))}
      </ul>
    </section>
  )
}
