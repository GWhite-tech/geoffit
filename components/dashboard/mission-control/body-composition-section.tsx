"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { SectionLabel } from "@/components/ui/section-label"
import type {
  BodyCompositionSeriesId,
  MissionControlView,
  McTimeRange,
} from "@/lib/health/analytics"
import {
  formatShortDate,
  formatShortDateWithYear,
  mcRangeWindow,
  toChartTimestamp,
} from "@/lib/health/analytics/series"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

const RANGES: { id: McTimeRange; label: string }[] = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "6m", label: "6M" },
  { id: "1y", label: "1Y" },
  { id: "all", label: "All" },
]

export function BodyCompositionSection({
  bodyComposition,
  range,
  onRangeChange,
}: {
  bodyComposition: MissionControlView["bodyComposition"]
  range: McTimeRange
  onRangeChange: (range: McTimeRange) => void
}) {
  const [enabled, setEnabled] = useState<Set<BodyCompositionSeriesId>>(
    () => new Set(["weight"])
  )

  const hasSeries = bodyComposition.series.some(
    (series) => series.available && series.points.length > 0
  )

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {}
    for (const series of bodyComposition.series) {
      config[series.id] = { label: series.label, color: series.color }
    }
    return config
  }, [bodyComposition.series])

  const chartData = useMemo(() => {
    const byDate = new Map<
      string,
      Record<string, string | number | null>
    >()
    for (const series of bodyComposition.series) {
      if (!enabled.has(series.id) || !series.available) continue
      for (const point of series.points) {
        const row = byDate.get(point.date) ?? {
          date: point.date,
          label: point.label,
          ts: toChartTimestamp(point.date),
        }
        row[series.id] = point.value
        byDate.set(point.date, row)
      }
    }
    return [...byDate.values()].sort(
      (a, b) => Number(a.ts) - Number(b.ts)
    )
  }, [bodyComposition.series, enabled])

  const xDomain = useMemo((): [number, number] | ["dataMin", "dataMax"] => {
    if (chartData.length === 0) return ["dataMin", "dataMax"]
    const endDay = String(chartData[chartData.length - 1]!.date)
    const window = mcRangeWindow(endDay, range)
    if (window == null) {
      return [
        Number(chartData[0]!.ts),
        Number(chartData[chartData.length - 1]!.ts),
      ]
    }
    return [toChartTimestamp(window.start), toChartTimestamp(window.end)]
  }, [chartData, range])

  const activeSeries = bodyComposition.series.filter(
    (series) => enabled.has(series.id) && series.available
  )

  if (!hasSeries) return null
  const pointsInWindow = activeSeries.reduce(
    (sum, series) => sum + series.points.length,
    0
  )
  const showDots = pointsInWindow > 0 && pointsInWindow <= 14
  const longRange = range === "1y" || range === "all" || range === "6m"

  function toggle(id: BodyCompositionSeriesId, available: boolean) {
    if (!available) return
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        if (next.size === 1) return prev
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionLabel>Body</SectionLabel>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            Weight and composition trends over time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-0.5">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onRangeChange(item.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                range === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.fadeUp}
        className="mc-surface-hero px-5 py-7 sm:px-8 sm:py-10"
      >
        <div className="mb-8 flex flex-wrap gap-2">
          {bodyComposition.series
            .filter((series) => series.available)
            .map((series) => {
            const on = enabled.has(series.id)
            return (
              <button
                key={series.id}
                type="button"
                onClick={() => toggle(series.id, series.available)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors",
                  on
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {!on ? (
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: series.color }}
                    aria-hidden
                  />
                ) : null}
                {series.label}
              </button>
            )
          })}
        </div>

        {activeSeries.length === 0 || chartData.length === 0 ? null : (
          <ChartContainer
            config={chartConfig}
            className="aspect-[2.15/1] min-h-[360px] w-full"
            initialDimension={{ width: 960, height: 420 }}
          >
            <ComposedChart
              key={range}
              data={chartData}
              margin={{ left: 4, right: 12, top: 12, bottom: 8 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeOpacity={0.28}
              />
              <XAxis
                dataKey="ts"
                type="number"
                domain={xDomain}
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                minTickGap={28}
                tickCount={range === "7d" ? 7 : undefined}
                tickFormatter={(value: number) => {
                  const iso = new Date(value).toISOString()
                  return longRange
                    ? formatShortDateWithYear(iso)
                    : formatShortDate(iso)
                }}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={48}
                domain={["auto", "auto"]}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as
                        | { date?: string }
                        | undefined
                      if (!row?.date) return null
                      return longRange
                        ? formatShortDateWithYear(row.date)
                        : formatShortDate(row.date)
                    }}
                  />
                }
              />
              {activeSeries.map((series) => (
                <Line
                  key={`${series.id}-${range}`}
                  type="monotone"
                  dataKey={series.id}
                  stroke={series.color}
                  strokeWidth={2.5}
                  dot={showDots ? { r: 3, strokeWidth: 0 } : false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls
                  isAnimationActive
                  animationDuration={450}
                  animationEasing="ease-out"
                />
              ))}
            </ComposedChart>
          </ChartContainer>
        )}
      </motion.div>
    </section>
  )
}
