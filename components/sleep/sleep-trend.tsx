"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { SectionLabel } from "@/components/ui/section-label"
import type { SleepSummary, SleepTrendRange } from "@/lib/health/sleep"
import { formatDurationMinutes } from "@/lib/health/types"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

const RANGES: { id: SleepTrendRange; label: string }[] = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "1y", label: "1Y" },
]

const chartConfig = {
  durationMinutes: {
    label: "Sleep",
    color: "var(--primary)",
  },
  weeklyAverageMinutes: {
    label: "Weekly avg",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

export function SleepTrend({
  trend,
  range,
  onRangeChange,
}: {
  trend: SleepSummary["trend"]
  range: SleepTrendRange
  onRangeChange: (range: SleepTrendRange) => void
}) {
  const data = useMemo(
    () =>
      trend.points.map((point) => ({
        ...point,
        durationHours: point.durationMinutes / 60,
        weeklyAverageHours:
          point.weeklyAverageMinutes != null
            ? point.weeklyAverageMinutes / 60
            : null,
        targetHours: point.targetMinutes / 60,
      })),
    [trend.points]
  )

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionLabel>Sleep Trend</SectionLabel>
        <div className="flex items-center gap-1 rounded-full border border-border/50 bg-card/40 p-1">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onRangeChange(item.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                range === item.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transitions.fadeUp, delay: 0.08 }}
        className="rounded-3xl border border-border/40 bg-card/25 px-2 py-6 sm:px-4 sm:py-8"
      >
        {data.length === 0 ? (
          <p className="px-6 text-sm leading-relaxed text-muted-foreground">
            Sleep trends appear once multiple nights of Sleep Analysis are
            available from Apple Health.
          </p>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-[2.2/1] w-full"
            initialDimension={{ width: 720, height: 320 }}
          >
            <ComposedChart data={data} margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="sleepFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                minTickGap={28}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={40}
                tickFormatter={(value: number) => `${value}h`}
                domain={[0, "auto"]}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => {
                      if (typeof value !== "number") return null
                      const minutes = Math.round(value * 60)
                      const label =
                        name === "durationHours"
                          ? "Sleep"
                          : name === "weeklyAverageHours"
                            ? "Weekly avg"
                            : String(name)
                      return (
                        <div className="flex w-full items-center justify-between gap-4">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium text-foreground">
                            {formatDurationMinutes(minutes)}
                          </span>
                        </div>
                      )
                    }}
                  />
                }
              />
              <ReferenceLine
                y={trend.targetMinutes / 60}
                stroke="var(--primary)"
                strokeDasharray="4 6"
                strokeOpacity={0.45}
              />
              <Area
                type="monotone"
                dataKey="durationHours"
                stroke="var(--primary)"
                fill="url(#sleepFill)"
                strokeWidth={2.25}
                dot={false}
                activeDot={{ r: 4, fill: "var(--primary)" }}
              />
              <Line
                type="monotone"
                dataKey="weeklyAverageHours"
                stroke="var(--chart-2)"
                strokeWidth={1.5}
                strokeOpacity={0.85}
                dot={false}
                connectNulls
              />
            </ComposedChart>
          </ChartContainer>
        )}
        <div className="mt-4 flex flex-wrap gap-5 px-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 rounded-full bg-primary" />
            Sleep duration
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 rounded-full bg-chart-2" />
            Weekly average
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-px w-4 border-t border-dashed border-primary/60" />
            Target {formatDurationMinutes(trend.targetMinutes)}
          </span>
        </div>
      </motion.div>
    </section>
  )
}

/** Local state wrapper for trend range control. */
export function useSleepTrendRange(initial: SleepTrendRange = "30d") {
  return useState<SleepTrendRange>(initial)
}
