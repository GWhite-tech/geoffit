"use client"

import { motion } from "framer-motion"

import { metrics } from "@/lib/dashboard-data"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

interface MetricItemProps {
  value: string
  label: string
  trend?: string
  className?: string
}

function MetricItem({ value, label, trend, className }: MetricItemProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[3rem] font-semibold leading-none tracking-tight text-foreground tabular-nums lg:text-[3.5rem]">
        {value}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      {trend ? (
        <p className="mt-1 text-[11px] text-success/70">{trend}</p>
      ) : null}
    </div>
  )
}

export function MissionControlMetrics() {
  const { missionScore, weight, waist, recovery } = metrics

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transitions.fadeUp, delay: 0.12 }}
      className="flex flex-wrap gap-x-12 gap-y-10 sm:gap-x-16 lg:gap-x-20"
    >
      <MetricItem value={String(missionScore)} label="Mission" />
      <MetricItem
        value={`${weight.value} ${weight.unit}`}
        label="Weight"
        trend={`↓ ${weight.trend}`}
      />
      <MetricItem
        value={`${waist.value} ${waist.unit}`}
        label="Waist"
      />
      <MetricItem
        value={`${recovery.value}%`}
        label="Recovery"
      />
    </motion.div>
  )
}
