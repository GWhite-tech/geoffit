"use client"

import { useMemo } from "react"
import { CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { SectionLabel } from "@/components/ui/section-label"
import type { TrainingPoint } from "@/lib/health/training"
import { cn } from "@/lib/utils"

export function MetricHero({
  label,
  value,
  detail,
  trend,
}: {
  label: string
  value: string
  detail?: string
  trend?: string | null
}) {
  return (
    <div className="mc-surface-hero px-6 py-8 sm:px-8 sm:py-10">
      <SectionLabel>{label}</SectionLabel>
      <p className="mt-5 text-[56px] leading-none font-semibold tracking-tight text-foreground sm:text-[64px]">
        {value}
      </p>
      {detail ? (
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          {detail}
        </p>
      ) : null}
      {trend ? (
        <p className="mt-3 text-[14px] font-medium text-foreground/80">{trend}</p>
      ) : null}
    </div>
  )
}

export function RangePills<T extends string>({
  items,
  value,
  onChange,
}: {
  items: Array<{ id: T; label: string }>
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-0.5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
            value === item.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function TrainingLineChart({
  series,
  rolling,
  goal,
  color = "var(--primary)",
  valueSuffix = "",
}: {
  series: TrainingPoint[]
  rolling?: TrainingPoint[]
  goal?: number
  color?: string
  valueSuffix?: string
}) {
  const config = useMemo(
    () =>
      ({
        value: { label: "Value", color },
        avg: { label: "Average", color: "var(--chart-2)" },
      }) satisfies ChartConfig,
    [color]
  )

  const data = useMemo(() => {
    const byDate = new Map<string, Record<string, string | number>>()
    for (const point of series) {
      byDate.set(point.date, {
        date: point.date,
        label: point.label,
        value: point.value,
      })
    }
    for (const point of rolling ?? []) {
      const row = byDate.get(point.date) ?? {
        date: point.date,
        label: point.label,
      }
      row.avg = point.value
      byDate.set(point.date, row)
    }
    return [...byDate.values()].sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    )
  }, [series, rolling])

  if (data.length === 0) {
    return (
      <p className="px-1 text-[15px] leading-relaxed text-muted-foreground">
        Not enough data in this range yet.
      </p>
    )
  }

  return (
    <ChartContainer
      config={config}
      className="aspect-[2.2/1] min-h-[280px] w-full"
      initialDimension={{ width: 880, height: 320 }}
    >
      <ComposedChart data={data} margin={{ left: 4, right: 12, top: 12, bottom: 8 }}>
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
          tickFormatter={(value: number) =>
            valueSuffix ? `${value}${valueSuffix}` : String(value)
          }
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        {goal != null ? (
          <ReferenceLine
            y={goal}
            stroke="var(--primary)"
            strokeDasharray="4 6"
            strokeOpacity={0.45}
          />
        ) : null}
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        {rolling && rolling.length > 0 ? (
          <Line
            type="monotone"
            dataKey="avg"
            stroke="var(--chart-2)"
            strokeWidth={1.5}
            strokeOpacity={0.85}
            dot={false}
          />
        ) : null}
      </ComposedChart>
    </ChartContainer>
  )
}
