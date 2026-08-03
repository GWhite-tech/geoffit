"use client"

import { motion } from "framer-motion"
import { useMemo, useState } from "react"

import { SectionLabel } from "@/components/ui/section-label"
import { cn } from "@/lib/utils"
import { transitions } from "@/lib/theme"

import type { ProgressPoint } from "@/lib/mission-control-data"

interface ProgressChartProps {
  metric: string
  unit: string
  goal: number
  weeklyAverage: number
  points: ProgressPoint[]
  className?: string
}

function smoothLinePath(
  dots: { x: number; y: number }[],
  chartBottom: number
): { line: string; area: string } {
  if (dots.length === 0) return { line: "", area: "" }

  const lineParts: string[] = [`M ${dots[0].x} ${dots[0].y}`]

  for (let i = 0; i < dots.length - 1; i += 1) {
    const current = dots[i]
    const next = dots[i + 1]
    const controlX = (current.x + next.x) / 2
    lineParts.push(`C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`)
  }

  const line = lineParts.join(" ")
  const area = `${line} L ${dots[dots.length - 1].x} ${chartBottom} L ${dots[0].x} ${chartBottom} Z`

  return { line, area }
}

export function ProgressChart({
  metric,
  unit,
  goal,
  weeklyAverage,
  points,
  className,
}: ProgressChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const width = 560
  const height = 330
  const padding = { top: 28, right: 12, bottom: 36, left: 8 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const chartBottom = padding.top + chartHeight

  const { linePath, areaPath, goalY, averageY, dots } = useMemo(() => {
    const values = points.map((p) => p.value)
    const dataMin = Math.min(...values, goal, weeklyAverage) - 0.5
    const dataMax = Math.max(...values, goal, weeklyAverage) + 0.5
    const range = dataMax - dataMin || 1

    const dotPositions = points.map((point, index) => {
      const x = padding.left + (index / (points.length - 1)) * chartWidth
      const y =
        padding.top + chartHeight - ((point.value - dataMin) / range) * chartHeight
      return { ...point, x, y, index }
    })

    const { line, area } = smoothLinePath(dotPositions, chartBottom)

    return {
      linePath: line,
      areaPath: area,
      goalY: padding.top + chartHeight - ((goal - dataMin) / range) * chartHeight,
      averageY:
        padding.top + chartHeight - ((weeklyAverage - dataMin) / range) * chartHeight,
      dots: dotPositions,
    }
  }, [points, goal, weeklyAverage, chartWidth, chartHeight, padding.left, padding.top, chartBottom])

  const active = activeIndex !== null ? dots[activeIndex] : null

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transitions.fadeUp, delay: 0.12 }}
      className={cn("surface-functional flex flex-col p-8 lg:p-9", className)}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionLabel>Progress</SectionLabel>
          <p className="mt-3 text-[1.125rem] font-medium text-foreground">{metric}</p>
        </div>
        <div className="text-right text-[13px] text-muted-foreground">
          <p>Goal {goal} {unit}</p>
          <p className="mt-1">Avg {weeklyAverage} {unit}</p>
        </div>
      </div>

      <div className="relative mt-4 flex-1">
        {active ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute top-0 left-0 rounded-lg bg-card/95 px-3 py-2 ring-1 ring-border/50"
          >
            <p className="text-xl font-semibold tabular-nums text-foreground">
              {active.value} {unit}
            </p>
            <p className="text-[13px] text-muted-foreground">{active.label}</p>
          </motion.div>
        ) : null}

        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="overflow-visible"
          onMouseLeave={() => setActiveIndex(null)}
          role="img"
          aria-label={`${metric} trend chart`}
        >
          <defs>
            <linearGradient id="progressGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={chartBottom}
            y2={chartBottom}
            className="stroke-border/30"
            strokeWidth="1"
          />

          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={averageY}
            y2={averageY}
            className="stroke-muted-foreground/25"
            strokeWidth="1"
            strokeDasharray="3 6"
          />

          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={goalY}
            y2={goalY}
            className="stroke-primary/25"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          <motion.path
            d={areaPath}
            fill="url(#progressGlow)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.15 }}
          />

          <motion.path
            d={linePath}
            fill="none"
            className="stroke-primary"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1, ease: [0.25, 0.1, 0.25, 1] }}
          />

          {dots.map((dot) => (
            <g key={dot.label}>
              <circle
                cx={dot.x}
                cy={dot.y}
                r="14"
                className="fill-transparent"
                onMouseEnter={() => setActiveIndex(dot.index)}
              />
              {activeIndex === dot.index ? (
                <circle
                  cx={dot.x}
                  cy={dot.y}
                  r="4.5"
                  className="fill-primary stroke-background stroke-2"
                />
              ) : null}
            </g>
          ))}

          <text
            x={padding.left}
            y={height - 10}
            className="fill-muted-foreground/50 text-[11px]"
          >
            {points[0]?.label}
          </text>
          <text
            x={width - padding.right}
            y={height - 10}
            textAnchor="end"
            className="fill-muted-foreground/50 text-[11px]"
          >
            {points[points.length - 1]?.label}
          </text>
        </svg>
      </div>
    </motion.section>
  )
}
