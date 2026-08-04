"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
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
import type {
  InterventionMarker,
  ProgressSeries,
  ProgressSeriesId,
} from "@/lib/health/progress"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function BodyCompositionChart({
  series,
  interventions,
}: {
  series: ProgressSeries[]
  interventions: InterventionMarker[]
}) {
  const [enabled, setEnabled] = useState<Set<ProgressSeriesId>>(
    () => new Set(["weight", "body_fat"])
  )
  const [showAverage, setShowAverage] = useState(true)
  const [showInterventions, setShowInterventions] = useState(true)

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {}
    for (const item of series) {
      config[item.id] = { label: item.label, color: item.color }
      config[`${item.id}_avg`] = {
        label: `${item.label} avg`,
        color: item.color,
      }
    }
    return config
  }, [series])

  const chartData = useMemo(() => {
    const byDate = new Map<string, Record<string, string | number>>()
    for (const item of series) {
      if (!enabled.has(item.id) || !item.available) continue
      for (const point of item.points) {
        const row = byDate.get(point.date) ?? {
          date: point.date,
          label: point.label,
        }
        row[item.id] = point.value
        byDate.set(point.date, row)
      }
      if (showAverage) {
        for (const point of item.rollingAverage) {
          const row = byDate.get(point.date) ?? {
            date: point.date,
            label: point.label,
          }
          row[`${item.id}_avg`] = point.value
          byDate.set(point.date, row)
        }
      }
    }
    return [...byDate.values()].sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    )
  }, [series, enabled, showAverage])

  const active = series.filter(
    (item) => enabled.has(item.id) && item.available
  )

  const markersInRange = useMemo(() => {
    if (!showInterventions || chartData.length === 0) return []
    const start = String(chartData[0]!.date)
    const end = String(chartData[chartData.length - 1]!.date)
    return interventions.filter(
      (marker) => marker.date >= start && marker.date <= end
    )
  }, [interventions, chartData, showInterventions])

  function toggle(id: ProgressSeriesId, available: boolean) {
    if (!available) return
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        if (next.size === 1) return prev
        next.delete(id)
      } else next.add(id)
      return next
    })
  }

  return (
    <section className="space-y-5">
      <div>
        <SectionLabel>Body Composition</SectionLabel>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Longitudinal trends with rolling averages and intervention markers.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.fadeUp}
        className="mc-surface-hero px-5 py-7 sm:px-8 sm:py-10"
      >
        <div className="mb-6 flex flex-wrap gap-2">
          {series.map((item) => {
            const on = enabled.has(item.id)
            return (
              <button
                key={item.id}
                type="button"
                disabled={!item.available}
                title={item.emptyHint ?? undefined}
                onClick={() => toggle(item.id, item.available)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors",
                  !item.available &&
                    "cursor-not-allowed text-muted-foreground/35",
                  item.available &&
                    on &&
                    "bg-primary text-primary-foreground",
                  item.available &&
                    !on &&
                    "border border-border/60 text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
                {!item.available ? " · Soon" : ""}
              </button>
            )
          })}
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          <ToggleChip
            active={showAverage}
            onClick={() => setShowAverage((value) => !value)}
            label="Rolling average"
          />
          <ToggleChip
            active={showInterventions}
            onClick={() => setShowInterventions((value) => !value)}
            label="Interventions"
          />
        </div>

        {active.length === 0 || chartData.length === 0 ? (
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {series.find((item) => item.id === "weight")?.emptyHint ??
              "Import body composition from Apple Health."}
          </p>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-[2.15/1] min-h-[380px] w-full"
            initialDimension={{ width: 960, height: 440 }}
          >
            <ComposedChart
              data={chartData}
              margin={{ left: 4, right: 12, top: 16, bottom: 4 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeOpacity={0.28}
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                minTickGap={28}
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
              <ChartTooltip content={<ChartTooltipContent />} />
              {markersInRange.map((marker) => {
                const exact = chartData.find((row) => row.date === marker.date)
                const nearest =
                  exact ??
                  chartData.reduce<(typeof chartData)[number] | null>(
                    (best, row) => {
                      if (!best) return row
                      const bestDist = Math.abs(
                        Date.parse(String(best.date)) -
                          Date.parse(marker.date)
                      )
                      const dist = Math.abs(
                        Date.parse(String(row.date)) - Date.parse(marker.date)
                      )
                      return dist < bestDist ? row : best
                    },
                    null
                  )
                if (!nearest?.label) return null
                return (
                  <ReferenceLine
                    key={marker.id}
                    x={String(nearest.label)}
                    stroke="var(--muted-foreground)"
                    strokeDasharray="4 4"
                    strokeOpacity={0.55}
                    label={{
                      value: marker.label.replace(/^Started /, ""),
                      position: "insideTopRight",
                      fill: "var(--muted-foreground)",
                      fontSize: 10,
                    }}
                  />
                )
              })}
              {active.map((item) => (
                <Line
                  key={item.id}
                  type="natural"
                  dataKey={item.id}
                  stroke={item.color}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls
                  isAnimationActive
                  animationDuration={700}
                  animationEasing="ease-out"
                />
              ))}
              {showAverage
                ? active.map((item) => (
                    <Line
                      key={`${item.id}-avg`}
                      type="natural"
                      dataKey={`${item.id}_avg`}
                      stroke={item.color}
                      strokeWidth={1.5}
                      strokeOpacity={0.45}
                      strokeDasharray="5 5"
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))
                : null}
            </ComposedChart>
          </ChartContainer>
        )}
      </motion.div>
    </section>
  )
}

function ToggleChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  )
}
