"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

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

type MacroId = "protein" | "carbohydrates" | "fat"

const MACROS: { id: MacroId; label: string; color: string }[] = [
  { id: "protein", label: "Protein", color: "var(--primary)" },
  { id: "carbohydrates", label: "Carbs", color: "var(--chart-2)" },
  { id: "fat", label: "Fat", color: "var(--chart-3)" },
]

export function MacroBreakdown({ chart }: { chart: NutritionChartData }) {
  const [enabled, setEnabled] = useState<Set<MacroId>>(
    () => new Set(["protein", "carbohydrates", "fat"])
  )

  const config = useMemo(() => {
    const next: ChartConfig = {}
    for (const macro of MACROS) {
      next[macro.id] = { label: macro.label, color: macro.color }
    }
    return next
  }, [])

  function toggle(id: MacroId) {
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
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionLabel>Macro breakdown</SectionLabel>
        <div className="flex flex-wrap gap-1">
          {MACROS.map((macro) => (
            <button
              key={macro.id}
              type="button"
              onClick={() => toggle(macro.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                enabled.has(macro.id)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {macro.label}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transitions.fadeUp, delay: 0.04 }}
        className="mc-surface-hero px-4 py-6 sm:px-6 sm:py-8"
      >
        {chart.points.length === 0 ? (
          <p className="text-[15px] text-muted-foreground">
            No macro history in this range.
          </p>
        ) : (
          <ChartContainer
            config={config}
            className="aspect-[2.4/1] min-h-[280px] w-full"
            initialDimension={{ width: 900, height: 360 }}
          >
            <BarChart
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
                width={40}
                tickFormatter={(value: number) => `${Math.round(value)}`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              {MACROS.filter((macro) => enabled.has(macro.id)).map((macro) => (
                <Bar
                  key={macro.id}
                  dataKey={macro.id}
                  stackId="macros"
                  fill={`var(--color-${macro.id})`}
                  radius={macro.id === "fat" ? [3, 3, 0, 0] : 0}
                  isAnimationActive
                  animationDuration={700}
                />
              ))}
            </BarChart>
          </ChartContainer>
        )}
      </motion.div>
    </section>
  )
}
