"use client"

import { motion } from "framer-motion"

import { MiniTrendSparkline } from "@/components/dashboard/mission-control/mini-trend-sparkline"
import { SectionLabel } from "@/components/ui/section-label"
import type { PerformanceCard } from "@/lib/health/analytics"
import { transitions } from "@/lib/theme"

export function PerformanceSection({ cards }: { cards: PerformanceCard[] }) {
  const present = cards.filter((card) => card.available && card.latestDisplay)
  if (present.length === 0) return null

  return (
    <section className="space-y-5">
      <div>
        <SectionLabel>Training</SectionLabel>
        <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
          Fitness and training rhythm over time.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transitions.fadeUp, delay: 0.08 }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {present.map((card) => (
          <div
            key={card.id}
            className="flex min-h-[140px] flex-col rounded-2xl bg-card/30 px-5 py-5"
          >
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              {card.label}
            </p>
            <div className="mt-4 flex flex-1 items-end justify-between gap-3">
              <p className="text-[30px] leading-none font-medium tracking-tight text-foreground">
                {card.latestDisplay}
              </p>
              <MiniTrendSparkline
                data={card.sparkline}
                className="mb-0.5 shrink-0"
              />
            </div>
            {card.trendDisplay ? (
              <p className="mt-3 text-[13px] text-muted-foreground">
                {card.trendDisplay}
              </p>
            ) : null}
          </div>
        ))}
      </motion.div>
    </section>
  )
}
