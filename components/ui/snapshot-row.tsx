"use client"

import { motion } from "framer-motion"

import { CountUp } from "@/components/ui/count-up"
import { cn } from "@/lib/utils"
import { transitions } from "@/lib/theme"

import type { TrendDirection } from "@/lib/mission-control-data"

interface SnapshotMetricProps {
  value: string
  label: string
  trend: string
  trendDirection?: TrendDirection
  numericValue?: number
  decimals?: number
  suffix?: string
}

const trendStyles: Record<TrendDirection, string> = {
  up: "text-muted-foreground",
  down: "text-muted-foreground",
  neutral: "text-muted-foreground",
  positive: "text-success/80",
}

export function SnapshotMetric({
  value,
  label,
  trend,
  trendDirection = "neutral",
  numericValue,
  decimals = 0,
  suffix = "",
}: SnapshotMetricProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitions.fadeUp}
      className="min-w-[7.5rem]"
    >
      <p className="text-[3.25rem] font-semibold leading-none tracking-tight text-foreground tabular-nums lg:text-[3.75rem]">
        {numericValue !== undefined ? (
          <CountUp value={numericValue} decimals={decimals} suffix={suffix} />
        ) : (
          value
        )}
      </p>
      <p className="mt-3 text-[13px] text-muted-foreground">{label}</p>
      <p className={cn("mt-1.5 text-[13px]", trendStyles[trendDirection])}>
        {trend}
      </p>
    </motion.div>
  )
}

interface SnapshotRowProps {
  metrics: SnapshotMetricProps[]
}

export function SnapshotRow({ metrics }: SnapshotRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transitions.fadeUp, delay: 0.06 }}
      className="flex flex-wrap gap-x-12 gap-y-10 lg:gap-x-16 xl:gap-x-20"
    >
      {metrics.map((metric) => (
        <SnapshotMetric key={metric.label} {...metric} />
      ))}
    </motion.div>
  )
}
