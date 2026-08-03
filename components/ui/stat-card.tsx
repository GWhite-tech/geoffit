"use client"

import type { LucideIcon } from "lucide-react"

import { AnimatedSurface } from "@/components/ui/animated-surface"
import { cn } from "@/lib/utils"
import type { Trend } from "@/lib/theme"

interface StatCardProps {
  label: string
  value: string | number
  hint?: string
  icon?: LucideIcon
  trend?: Trend
  change?: string
  className?: string
}

const trendStyles: Record<Trend, string> = {
  up: "text-success",
  down: "text-warning",
  neutral: "text-muted-foreground",
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend = "neutral",
  change,
  className,
}: StatCardProps) {
  return (
    <AnimatedSurface className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          {label}
        </p>
        {Icon ? <Icon className="size-4 text-primary" /> : null}
      </div>

      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>

      {(hint || change) && (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          {hint ? <span className="text-muted-foreground">{hint}</span> : <span />}
          {change ? (
            <span className={cn("font-medium", trendStyles[trend])}>{change}</span>
          ) : null}
        </div>
      )}
    </AnimatedSurface>
  )
}
