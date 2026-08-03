"use client"

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { AnimatedSurface } from "@/components/ui/animated-surface"
import { cn } from "@/lib/utils"
import type { MetricStatus, Trend } from "@/lib/theme"

interface MetricCardProps {
  title: string
  value: string | number
  unit?: string
  change?: string
  trend?: Trend
  icon?: LucideIcon
  sparkline?: number[]
  status?: MetricStatus
  footer?: string
  className?: string
}

const trendStyles: Record<Trend, string> = {
  up: "text-success",
  down: "text-warning",
  neutral: "text-muted-foreground",
}

const statusStyles: Record<MetricStatus, string> = {
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/10 text-warning ring-warning/20",
  danger: "bg-destructive/10 text-destructive ring-destructive/20",
  neutral: "bg-muted text-muted-foreground ring-border",
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const width = 72
  const height = 28

  const points = data
    .map((point, index) => {
      const x = (index / (data.length - 1)) * width
      const y = height - ((point - min) / range) * height
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="text-primary"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

function TrendIndicator({ trend, change }: { trend: Trend; change?: string }) {
  const Icon =
    trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus

  if (!change) return null

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        trendStyles[trend]
      )}
    >
      <Icon className="size-3" />
      {change}
    </span>
  )
}

export function MetricCard({
  title,
  value,
  unit,
  change,
  trend = "neutral",
  icon: Icon,
  sparkline,
  status,
  footer,
  className,
}: MetricCardProps) {
  return (
    <AnimatedSurface className={className}>
      <div className="flex items-start justify-between gap-4">
        {Icon ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <Icon className="size-4 text-primary" />
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          {status ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 capitalize",
                statusStyles[status]
              )}
            >
              {status}
            </span>
          ) : null}
          <TrendIndicator trend={trend} change={change} />
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            {title}
          </p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground tabular-nums">
            {value}
            {unit ? (
              <span className="ml-1.5 text-lg font-normal text-muted-foreground">
                {unit}
              </span>
            ) : null}
          </p>
          {footer ? (
            <p className="mt-2 text-xs text-muted-foreground">{footer}</p>
          ) : null}
        </div>

        {sparkline ? <Sparkline data={sparkline} /> : null}
      </div>
    </AnimatedSurface>
  )
}
