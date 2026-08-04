"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
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
import { CountUp } from "@/components/ui/count-up"
import { SectionLabel } from "@/components/ui/section-label"
import type { BloodChartRange } from "@/lib/health/blood/biomarker-history"
import { buildBiomarkerInsights } from "@/lib/health/blood/biomarker-insights"
import { buildInterpretationBands } from "@/lib/health/blood/interpretation-bands"
import { useBiomarkerHistory } from "@/lib/health/blood/use-blood-markers"
import {
  formatBiomarkerDelta,
  formatBiomarkerValue,
} from "@/lib/health/biomarker-registry"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

const RANGES: { id: BloodChartRange; label: string }[] = [
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "6m", label: "6M" },
  { id: "1y", label: "1Y" },
  { id: "all", label: "All" },
]

function shortDelta(delta: number, unit: string): string {
  return formatBiomarkerDelta(delta, unit).display.replace(
    /\s+over previous result$/,
    ""
  )
}

function goalLineValue(
  interpretation: string,
  optimal?: { low?: number; high?: number }
): number | null {
  if (!optimal) return null
  if (interpretation === "lower_is_better" && optimal.high != null) {
    return optimal.high
  }
  if (interpretation === "higher_is_better" && optimal.low != null) {
    return optimal.low
  }
  return null
}

export function BloodMarkerPanel({ biomarkerId }: { biomarkerId: string }) {
  const [range, setRange] = useState<BloodChartRange>("all")
  const summary = useBiomarkerHistory(biomarkerId, range)

  const chartConfig = useMemo((): ChartConfig => {
    if (!summary) return { value: { label: "Value", color: "var(--primary)" } }
    return {
      value: {
        label: summary.biomarker.shortName,
        color: summary.biomarker.chart.color,
      },
    }
  }, [summary])

  const chartData = useMemo(() => {
    if (!summary) return []
    return summary.rangedPoints.map((point) => ({
      date: point.date,
      label: point.dateLabel,
      value: point.value,
      status: point.status.label,
    }))
  }, [summary])

  const insights = useMemo(
    () => (summary ? buildBiomarkerInsights(summary) : []),
    [summary]
  )

  const bands = useMemo(() => {
    if (!summary) return []
    return buildInterpretationBands(
      summary.biomarker,
      summary.analytics.latest?.value ?? null
    )
  }, [summary])

  if (!summary) {
    return (
      <div className="flex h-full items-center justify-center px-8 py-16">
        <p className="text-[15px] text-muted-foreground">Unknown biomarker.</p>
      </div>
    )
  }

  const { biomarker, analytics, points } = summary
  const latest = analytics.latest
  const previous = analytics.previous
  const reference = biomarker.referenceRange
  const optimal = biomarker.optimalRange
  const goal = goalLineValue(biomarker.interpretation, optimal)

  const yValues = chartData.map((point) => point.value)
  if (reference.low != null) yValues.push(reference.low)
  if (reference.high != null) yValues.push(reference.high)
  if (optimal?.low != null) yValues.push(optimal.low)
  if (optimal?.high != null) yValues.push(optimal.high)
  if (goal != null) yValues.push(goal)

  const rawMin = yValues.length ? Math.min(...yValues) : 0
  const rawMax = yValues.length ? Math.max(...yValues) : 1
  const pad = (rawMax - rawMin) * biomarker.chart.yPaddingFraction || 1
  const domain: [number, number] = [
    Math.max(0, rawMin - pad),
    rawMax + pad,
  ]

  const timeline = [...points].reverse()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={biomarker.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={transitions.fadeUp}
        className="mx-auto flex w-full max-w-[920px] flex-col gap-10 px-6 py-8 lg:px-10"
      >
        <header>
          <h1 className="text-[34px] font-semibold tracking-tight text-foreground sm:text-[40px]">
            {biomarker.displayName}
          </h1>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {latest ? (
              <>
                <p className="text-[28px] leading-none font-medium tracking-tight text-foreground sm:text-[32px]">
                  <CountUp
                    value={latest.value}
                    decimals={biomarker.chart.preferredDecimals}
                    suffix={biomarker.unit ? ` ${biomarker.unit}` : ""}
                  />
                </p>
                <p
                  className={cn(
                    "text-[15px] font-medium",
                    latest.clinicalStatus.colorClass
                  )}
                >
                  {latest.clinicalStatus.label}
                </p>
              </>
            ) : (
              <p className="text-[17px] text-muted-foreground">No readings yet</p>
            )}
          </div>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            {biomarker.description}
          </p>
        </header>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionLabel>Trend</SectionLabel>
            <div className="flex flex-wrap items-center gap-0.5">
              {RANGES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRange(item.id)}
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transitions.fadeUp, delay: 0.04 }}
            className="mc-surface-hero px-4 py-6 sm:px-6 sm:py-8"
          >
            {chartData.length === 0 ? (
              <p className="px-1 text-[15px] leading-relaxed text-muted-foreground">
                Import blood tests to chart {biomarker.shortName} over time.
              </p>
            ) : (
              <ChartContainer
                config={chartConfig}
                className="aspect-[2.15/1] min-h-[320px] w-full"
                initialDimension={{ width: 860, height: 400 }}
              >
                <ComposedChart
                  data={chartData}
                  margin={{ left: 4, right: 12, top: 12, bottom: 4 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--border)"
                    strokeOpacity={0.28}
                  />
                  {reference.low != null && reference.high != null ? (
                    <ReferenceArea
                      y1={reference.low}
                      y2={reference.high}
                      fill="var(--primary)"
                      fillOpacity={0.07}
                      ifOverflow="extendDomain"
                    />
                  ) : null}
                  {goal != null ? (
                    <ReferenceLine
                      y={goal}
                      stroke="var(--primary)"
                      strokeDasharray="4 4"
                      strokeOpacity={0.55}
                    />
                  ) : null}
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={12}
                    minTickGap={28}
                  />
                  <YAxis
                    domain={domain}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    tickFormatter={(value: number) =>
                      Number(value).toFixed(biomarker.chart.preferredDecimals)
                    }
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="natural"
                    dataKey="value"
                    stroke="transparent"
                    fill="var(--primary)"
                    fillOpacity={0.08}
                    isAnimationActive
                    animationDuration={700}
                  />
                  <Line
                    type="natural"
                    dataKey="value"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, strokeWidth: 0, fill: "var(--primary)" }}
                    activeDot={{ r: 6, strokeWidth: 0, fill: "var(--primary)" }}
                    isAnimationActive
                    animationDuration={750}
                  />
                </ComposedChart>
              </ChartContainer>
            )}
          </motion.div>
        </section>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transitions.fadeUp, delay: 0.06 }}
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <SummaryCard
            label="Latest"
            value={
              latest
                ? formatBiomarkerValue(biomarker.id, latest.value)
                : "—"
            }
          />
          <SummaryCard
            label="Previous"
            value={
              previous
                ? formatBiomarkerValue(biomarker.id, previous.value)
                : "—"
            }
          />
          <SummaryCard
            label="Change"
            value={
              previous && latest
                ? shortDelta(latest.value - previous.value, latest.unit)
                : "—"
            }
            accent={
              previous && latest
                ? latest.value - previous.value < 0
                  ? "down"
                  : latest.value - previous.value > 0
                    ? "up"
                    : "neutral"
                : undefined
            }
          />
          <SummaryCard
            label={biomarker.clinicalBands?.length ? "Clinical" : "Status"}
            value={latest?.clinicalStatus.label ?? "—"}
            statusClass={latest?.clinicalStatus.colorClass}
          />
        </motion.div>

        {biomarker.clinicalBands?.length && latest ? (
          <section className="space-y-4">
            <SectionLabel>Interpretation</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="mc-card px-5 py-5">
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
                  Clinical status
                </p>
                <p
                  className={cn(
                    "mt-3 text-[22px] leading-none font-medium tracking-tight",
                    latest.clinicalStatus.colorClass
                  )}
                >
                  {latest.clinicalStatus.label}
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                  Geoffit clinical thresholds for {biomarker.shortName}.
                </p>
              </div>
              <div className="mc-card px-5 py-5">
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
                  Laboratory status
                </p>
                <p
                  className={cn(
                    "mt-3 text-[22px] leading-none font-medium tracking-tight",
                    latest.laboratoryStatus.colorClass
                  )}
                >
                  {latest.laboratoryStatus.label}
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                  Reference: {latest.laboratoryRangeDisplay}
                </p>
              </div>
            </div>
            {latest.dual.explanation ? (
              <p className="mc-card px-5 py-4 text-[15px] leading-relaxed text-foreground/90">
                {latest.dual.explanation}
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="space-y-4">
          <SectionLabel>
            {biomarker.clinicalBands?.length
              ? "Clinical thresholds"
              : "Reference Range"}
          </SectionLabel>
          <div className="mc-card grid gap-2 px-2 py-2 sm:grid-cols-2 lg:grid-cols-3">
            {bands.map((band) => (
              <div
                key={band.id}
                className={cn(
                  "rounded-xl px-4 py-3.5 transition-colors",
                  band.active ? "bg-primary/12" : "bg-transparent"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={cn("text-[13px] font-medium", band.colorClass)}>
                    {band.label}
                  </p>
                  {band.active ? (
                    <span className="text-[11px] font-medium text-primary">
                      You
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[15px] tracking-tight text-foreground">
                  {band.rangeText}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <SectionLabel>Insights</SectionLabel>
          <ul className="space-y-2.5">
            {insights.map((insight, index) => (
              <motion.li
                key={insight.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...transitions.fadeUp, delay: 0.05 + index * 0.03 }}
                className="mc-card px-5 py-4 text-[15px] leading-relaxed text-foreground/90"
              >
                {insight.body}
              </motion.li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <SectionLabel>Timeline</SectionLabel>
          {timeline.length === 0 ? (
            <div className="mc-card px-5 py-6 text-[15px] text-muted-foreground">
              Future imports will appear here automatically.
            </div>
          ) : (
            <div className="mc-card overflow-hidden">
              <div className="grid grid-cols-[1.2fr_1fr_1fr_0.9fr] gap-3 border-b border-border/30 px-5 py-3 text-[11px] font-medium tracking-[0.12em] text-muted-foreground/70 uppercase">
                <span>Date</span>
                <span>Source</span>
                <span>Result</span>
                <span>Change</span>
              </div>
              <ul className="divide-y divide-border/25">
                {timeline.map((point) => (
                  <li
                    key={`${point.testId}-${point.date}`}
                    className="grid grid-cols-[1.2fr_1fr_1fr_0.9fr] items-center gap-3 px-5 py-3.5"
                  >
                    <span className="text-[14px] text-foreground">
                      {point.dateLabel}
                    </span>
                    <span className="truncate text-[14px] text-muted-foreground">
                      {point.provider || point.source || "—"}
                    </span>
                    <span className="text-[14px] font-medium text-foreground">
                      {formatBiomarkerValue(biomarker.id, point.value)}
                    </span>
                    <span className="text-[14px] text-muted-foreground">
                      {point.changeFromPrevious == null
                        ? "—"
                        : shortDelta(point.changeFromPrevious, point.unit)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </motion.div>
    </AnimatePresence>
  )
}

function SummaryCard({
  label,
  value,
  statusClass,
  accent,
}: {
  label: string
  value: string
  statusClass?: string
  accent?: "up" | "down" | "neutral"
}) {
  return (
    <div className="mc-card px-5 py-5">
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-3 text-[22px] leading-none font-medium tracking-tight sm:text-[24px]",
          statusClass ?? "text-foreground",
          accent === "down" && !statusClass && "text-foreground",
          accent === "up" && !statusClass && "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  )
}
