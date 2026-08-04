"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import type { SleepSummary } from "@/lib/health/sleep"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

function MiniSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const width = 72
  const height = 28
  const points = data
    .map((point, index) => {
      const x = (index / (data.length - 1)) * width
      const y = height - ((point - min) / range) * (height - 2) - 1
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="text-primary/75"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

export function SleepRecoverySignals({
  signals,
}: {
  signals: SleepSummary["recoverySignals"]
}) {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <SectionLabel>Recovery Signals</SectionLabel>
        <p className="max-w-xl text-sm text-muted-foreground">
          Correlations that will power future AI insights — drawn only from your
          Health Store.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transitions.fadeUp, delay: 0.12 }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        {signals.map((signal) => (
          <div
            key={signal.id}
            className="rounded-2xl border border-border/50 bg-card/40 px-5 py-5"
          >
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
              {signal.label}
            </p>
            {signal.available ? (
              <>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <p className="text-xl font-medium tracking-tight text-foreground">
                    {signal.value}
                  </p>
                  <MiniSparkline data={signal.sparkline} />
                </div>
                {signal.trend ? (
                  <p
                    className={cn(
                      "mt-2 text-xs",
                      signal.trendDirection === "up"
                        ? "text-success"
                        : "text-muted-foreground"
                    )}
                  >
                    {signal.trend}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p className="mt-4 text-lg font-medium text-muted-foreground/70">
                  Coming soon
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground/60">
                  {signal.emptyHint}
                </p>
              </>
            )}
          </div>
        ))}
      </motion.div>
    </section>
  )
}
