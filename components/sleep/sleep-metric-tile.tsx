"use client"

import { cn } from "@/lib/utils"
import type { SleepMetric } from "@/lib/health/sleep"

function MiniSparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const width = 64
  const height = 24
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
      className={cn("text-primary/80", className)}
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

export function SleepMetricTile({
  label,
  metric,
  className,
}: {
  label: string
  metric: SleepMetric<number>
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-2xl border border-border/50 bg-card/40 px-5 py-5",
        className
      )}
    >
      <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground/70 uppercase">
        {label}
      </p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p
            className={cn(
              "text-2xl font-medium tracking-tight",
              metric.available ? "text-foreground" : "text-muted-foreground/70"
            )}
          >
            {metric.display}
          </p>
          {metric.available && metric.trend ? (
            <p className="mt-1.5 text-xs text-muted-foreground">{metric.trend}</p>
          ) : !metric.available ? (
            <p className="mt-1.5 max-w-[12rem] text-xs leading-relaxed text-muted-foreground/60">
              {metric.reason}
            </p>
          ) : null}
        </div>
        {metric.available && metric.sparkline && metric.sparkline.length > 1 ? (
          <MiniSparkline data={metric.sparkline} />
        ) : null}
      </div>
    </div>
  )
}
