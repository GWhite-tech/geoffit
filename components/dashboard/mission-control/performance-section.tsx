"use client"

import { motion } from "framer-motion"

import { MiniTrendSparkline } from "@/components/dashboard/mission-control/mini-trend-sparkline"
import { SectionLabel } from "@/components/ui/section-label"
import type { PerformanceCard } from "@/lib/health/analytics"
import { transitions } from "@/lib/theme"

export function PerformanceSection({ cards }: { cards: PerformanceCard[] }) {
  return (
    <section className="space-y-6">
      <div>
        <SectionLabel>Performance</SectionLabel>
        <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
          Fitness capacity and training rhythm over time.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transitions.fadeUp, delay: 0.08 }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {cards.map((card) => (
          <div
            key={card.id}
            className="mc-card flex min-h-[156px] flex-col px-6 py-6"
          >
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/65 uppercase">
              {card.label}
            </p>
            {card.available ? (
              <>
                <div className="mt-5 flex flex-1 items-end justify-between gap-3">
                  <p className="text-[32px] leading-none font-medium tracking-tight text-foreground sm:text-[36px]">
                    {card.latestDisplay}
                  </p>
                  <MiniTrendSparkline
                    data={card.sparkline}
                    className="mb-0.5 shrink-0"
                  />
                </div>
                {card.trendDisplay ? (
                  <p className="mt-4 text-[13px] text-muted-foreground">
                    {card.trendDisplay}
                  </p>
                ) : (
                  <p className="mt-4 text-[13px] text-transparent select-none">
                    —
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="mt-5 text-[28px] leading-none font-medium text-muted-foreground/55">
                  Coming soon
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground/55">
                  {card.emptyHint}
                </p>
              </>
            )}
          </div>
        ))}
      </motion.div>
    </section>
  )
}
