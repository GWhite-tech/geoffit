"use client"

import Link from "next/link"
import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import type { NutritionSummary } from "@/lib/health/nutrition"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function DailyHistory({
  history,
}: {
  history: NutritionSummary["history"]
}) {
  return (
    <section className="space-y-4">
      <SectionLabel>Daily history</SectionLabel>
      {history.length === 0 ? (
        <div className="mc-card px-5 py-6 text-[15px] text-muted-foreground">
          No days in this range.
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitions.fadeUp}
          className="mc-card overflow-hidden"
        >
          <div className="grid grid-cols-[1.1fr_repeat(6,0.75fr)_0.7fr] gap-2 border-b border-border/30 px-4 py-3 text-[11px] font-medium tracking-[0.1em] text-muted-foreground/70 uppercase">
            <span>Date</span>
            <span>Cal</span>
            <span>Pro</span>
            <span>Carb</span>
            <span>Fat</span>
            <span>Fibre</span>
            <span>Water</span>
            <span>Target</span>
          </div>
          <ul className="divide-y divide-border/25">
            {history.slice(0, 45).map((day) => (
              <li key={day.id}>
                <Link
                  href={`/nutrition/${day.date}`}
                  className="grid grid-cols-[1.1fr_repeat(6,0.75fr)_0.7fr] items-center gap-2 px-4 py-3 text-[13px] transition-colors hover:bg-card/40"
                >
                  <span className="font-medium text-foreground">
                    {day.label}
                  </span>
                  <span className="text-muted-foreground">
                    {Math.round(day.calories).toLocaleString("en-GB")}
                  </span>
                  <span className="text-muted-foreground">
                    {Math.round(day.protein)}
                  </span>
                  <span className="text-muted-foreground">
                    {Math.round(day.carbohydrates)}
                  </span>
                  <span className="text-muted-foreground">
                    {Math.round(day.fat)}
                  </span>
                  <span className="text-muted-foreground">
                    {Math.round(day.fibre)}
                  </span>
                  <span className="text-muted-foreground">
                    {day.water.toFixed(1)}
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      day.targetMet ? "text-success" : "text-muted-foreground/70"
                    )}
                  >
                    {day.targetMet ? "Met" : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </section>
  )
}
