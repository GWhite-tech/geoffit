"use client"

import { motion } from "framer-motion"

import { CountUp } from "@/components/ui/count-up"
import { TrendBadge } from "@/components/mobile/trend-badge"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function HealthScore({
  score,
  delta,
  deltaLabel,
  summary,
  className,
}: {
  score: number | null
  delta?: number | null
  deltaLabel?: string | null
  summary: string
  className?: string
}) {
  const direction =
    delta == null || delta === 0 ? "neutral" : delta > 0 ? "up" : "down"
  const deltaText =
    deltaLabel ??
    (delta == null
      ? null
      : delta > 0
        ? `+${delta} this week`
        : delta < 0
          ? `${delta} this week`
          : "No change")

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitions.fadeUp}
      className={cn("px-1", className)}
    >
      <p className="text-[13px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        Health Score
      </p>
      <div className="mt-3 flex items-end gap-3">
        {score == null ? (
          <p className="text-[72px] leading-none font-semibold tracking-tight text-muted-foreground/35">
            —
          </p>
        ) : (
          <CountUp
            value={score}
            className="text-[72px] leading-none font-semibold tracking-tight text-foreground tabular-nums"
          />
        )}
      </div>
      {deltaText ? (
        <div className="mt-3">
          <TrendBadge direction={direction} label={deltaText} goodWhen="up" />
        </div>
      ) : null}
      <p className="mt-4 max-w-[34ch] text-[17px] leading-snug text-muted-foreground">
        {summary}
      </p>
    </motion.section>
  )
}
