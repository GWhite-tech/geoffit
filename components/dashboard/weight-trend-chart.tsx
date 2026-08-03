"use client"

import { motion } from "framer-motion"

import { weightTrend } from "@/lib/dashboard-data"
import { transitions } from "@/lib/theme"

export function WeightTrendChart() {
  const width = 420
  const height = 64
  const padding = { top: 8, bottom: 20, left: 0, right: 0 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const values = weightTrend.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = weightTrend
    .map((point, index) => {
      const x = padding.left + (index / (weightTrend.length - 1)) * chartWidth
      const y =
        padding.top + chartHeight - ((point.value - min) / range) * chartHeight
      return `${x},${y}`
    })
    .join(" ")

  const first = weightTrend[0]
  const last = weightTrend[weightTrend.length - 1]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transitions.fadeUp, delay: 0.16 }}
      className="max-w-[420px]"
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="text-foreground/50"
        aria-label="Weight trend over the last seven days"
        role="img"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        <circle
          cx={padding.left + chartWidth}
          cy={
            padding.top +
            chartHeight -
            ((last.value - min) / range) * chartHeight
          }
          r="2.5"
          className="fill-foreground"
        />
        <text
          x={padding.left}
          y={height - 4}
          className="fill-muted-foreground text-[10px]"
        >
          {first.label}
        </text>
        <text
          x={width - padding.right}
          y={height - 4}
          textAnchor="end"
          className="fill-muted-foreground text-[10px]"
        >
          {last.label}
        </text>
      </svg>
    </motion.div>
  )
}
