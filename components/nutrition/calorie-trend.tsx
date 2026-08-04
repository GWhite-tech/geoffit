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
import type { NutritionChartData } from "@/lib/health/nutrition"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

type SeriesId = "calories" | "average" | "target"

const SERIES: { id: SeriesId; label: string }[] = [
  { id: "calories", label: "Calories" },
  { id: "average", label: "Average" },
  { id: "target", label: "Target" },
]

export function CalorieTrend({ chart }: { chart: NutritionChartData }) {
  const [enabled, setEnabled] = useState<Set<SeriesId>>(
    () => new Set(["calories", "average", "target"])
  )

  const config = useMemo(
    (): ChartConfig => ({
      calories: { label: "Calories", color: "var(--primary)" },
      average: { label: "7-day avg", color: "var(--chart-2)" },
      target: { label: "Target", color: "var(--muted-foreground)" },
    }),
    []
  )

  function toggle(id: SeriesId) {
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        if (next.size === 1) return prev
        next.delete(id)
      } else next.add(id)
      return next
    })
  }

  const target = chart.points[0]?.target ?? 2200

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionLabel>Calorie trend</SectionLabel>
        <div className="flex flex-wrap gap-1">
          {SERIES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                enabled.has(item.id)
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
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.fadeUp}
        className="mc-surface-hero px-4 py-6 sm:px-6 sm:py-8"
      >
        {chart.points.length === 0 ? (
          <p className="text-[15px] text-muted-foreground">
            No calorie history in this range.
          </p>
        ) : (
          <ChartContainer
            config={config}
            className="aspect-[2.15/1] min-h-[320px] w-full"
            initialDimension={{ width: 900, height: 400 }}
          >
            <ComposedChart
              data={chart.points}
              margin={{ left: 4, right: 12, top: 12, bottom: 4 }}
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
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(value: number) =>
                  Math.round(value).toLocaleString("en-GB")
                }
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              {enabled.has("target") ? (
                <ReferenceLine
                  y={target}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.55}
                />
              ) : null}
              {enabled.has("average") ? (
                <Line
                  type="natural"
                  dataKey="average"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive
                  animationDuration={700}
                />
              ) : null}
              {enabled.has("calories") ? (
                <Line
                  type="natural"
                  dataKey="calories"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive
                  animationDuration={750}
                />
              ) : null}
            </ComposedChart>
          </ChartContainer>
        )}
      </motion.div>
    </section>
  )
}
