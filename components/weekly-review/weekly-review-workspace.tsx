"use client"

import { useMemo, type ReactNode } from "react"
import { motion } from "framer-motion"
import { Check, FileDown } from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { SectionLabel } from "@/components/ui/section-label"
import {
  downloadWeeklyReviewJson,
  downloadWeeklyReviewMarkdown,
  printWeeklyReviewPdf,
  useWeeklyReview,
  type WeeklyChartPoint,
  type WeeklyReviewView,
} from "@/lib/health/weekly-review"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function WeeklyReviewWorkspace() {
  const { view, weeks, selectedWeekId, setSelectedWeekId, regenerate } =
    useWeeklyReview()

  return (
    <div className="min-h-[calc(100svh-2.75rem)] w-full overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.fadeUp}
        className="mx-auto flex w-full max-w-[820px] flex-col gap-20 px-5 py-10 sm:px-8 lg:py-14 print:max-w-none print:gap-12 print:px-0"
      >
        <header className="flex flex-wrap items-end justify-between gap-4 print:hidden">
          <div>
            <SectionLabel>Executive briefing</SectionLabel>
            <h1 className="mt-3 text-[34px] font-semibold tracking-tight text-foreground sm:text-[40px]">
              Weekly Review
            </h1>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              Your week, distilled — not a report.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
                Week
              </span>
              <select
                value={selectedWeekId}
                onChange={(event) => setSelectedWeekId(event.target.value)}
                className="rounded-lg border border-border/50 bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary/50"
              >
                {weeks.map((week) => (
                  <option key={week.id} value={week.id}>
                    {week.label} · {week.rangeLabel}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <ExportButton
                label="PDF"
                onClick={() => printWeeklyReviewPdf()}
              />
              <ExportButton
                label="Markdown"
                onClick={() => downloadWeeklyReviewMarkdown(view)}
              />
              <ExportButton
                label="JSON"
                onClick={() => downloadWeeklyReviewJson(view)}
              />
              <button
                type="button"
                onClick={regenerate}
                className="rounded-full border border-border/50 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Regenerate
              </button>
            </div>
          </div>
        </header>

        {!view.hasData ? (
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Import health data, nutrition, training, and treatments to generate
            your first briefing.
          </p>
        ) : null}

        <WeeklySummaryHero view={view} />
        <BiggestWins wins={view.wins} />
        <BodyCompositionSection data={view.bodyComposition} />
        <NarrativeBlock
          label="Training"
          lines={view.training.narrative}
          stats={[
            { label: "Strength", value: String(view.training.strengthSessions) },
            { label: "Cardio", value: String(view.training.cardioSessions) },
            {
              label: "Volume",
              value:
                view.training.volumeKg != null
                  ? `${view.training.volumeKg.toLocaleString("en-GB")} kg`
                  : "—",
            },
            { label: "Load", value: view.training.loadLabel },
            {
              label: "Adherence",
              value:
                view.training.adherencePct != null
                  ? `${view.training.adherencePct}%`
                  : "—",
            },
            {
              label: "Quality",
              value:
                view.training.qualityAvg != null
                  ? String(view.training.qualityAvg)
                  : "—",
            },
          ]}
          extras={
            view.training.prs.length > 0 ? (
              <ul className="mt-6 space-y-2">
                {view.training.prs.map((pr) => (
                  <li
                    key={pr}
                    className="text-[15px] leading-relaxed text-foreground/85"
                  >
                    {pr}
                  </li>
                ))}
              </ul>
            ) : null
          }
        />
        <NarrativeBlock
          label="Recovery"
          lines={view.recovery.narrative}
          stats={[
            {
              label: "Recovery",
              value:
                view.recovery.recoveryAvg != null
                  ? `${view.recovery.recoveryAvg}%`
                  : "—",
            },
            {
              label: "Sleep avg",
              value:
                view.recovery.sleepAvgHours != null
                  ? `${view.recovery.sleepAvgHours.toFixed(1)} h`
                  : "—",
            },
            {
              label: "Best night",
              value:
                view.recovery.bestNightHours != null
                  ? `${view.recovery.bestNightHours.toFixed(1)} h`
                  : "—",
            },
            {
              label: "Worst night",
              value:
                view.recovery.worstNightHours != null
                  ? `${view.recovery.worstNightHours.toFixed(1)} h`
                  : "—",
            },
            {
              label: "HRV",
              value: view.recovery.hrv != null ? `${view.recovery.hrv} ms` : "—",
            },
            {
              label: "Resting HR",
              value:
                view.recovery.restingHr != null
                  ? `${view.recovery.restingHr} bpm`
                  : "—",
            },
          ]}
        />
        <NarrativeBlock
          label="Nutrition"
          lines={view.nutrition.narrative}
          stats={[
            {
              label: "Calories",
              value:
                view.nutrition.avgCalories != null
                  ? String(view.nutrition.avgCalories)
                  : "—",
            },
            {
              label: "Protein",
              value:
                view.nutrition.avgProtein != null
                  ? `${view.nutrition.avgProtein} g`
                  : "—",
            },
            {
              label: "Carbs",
              value:
                view.nutrition.avgCarbs != null
                  ? `${view.nutrition.avgCarbs} g`
                  : "—",
            },
            {
              label: "Fat",
              value:
                view.nutrition.avgFat != null
                  ? `${view.nutrition.avgFat} g`
                  : "—",
            },
            {
              label: "Water",
              value:
                view.nutrition.avgWater != null
                  ? `${view.nutrition.avgWater.toFixed(1)} L`
                  : "—",
            },
            {
              label: "Score",
              value:
                view.nutrition.nutritionScore != null
                  ? String(view.nutrition.nutritionScore)
                  : "—",
            },
          ]}
        />
        <SimpleNarrative
          label="Blood Markers"
          lines={view.blood.narrative}
        />
        <SimpleNarrative
          label="Treatments"
          lines={view.treatments.narrative}
        />
        <HealthStorySection story={view.story} />
        <WhatChangedSection
          positive={view.positiveChanges}
          negative={view.negativeChanges}
        />
        <FocusSection items={view.focus} />
        <ForecastSection items={view.forecast} />
        <CoachNote note={view.coachNote} />
      </motion.div>
    </div>
  )
}

function ExportButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-border/50 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <FileDown className="size-3.5" />
      {label}
    </button>
  )
}

function WeeklySummaryHero({ view }: { view: WeeklyReviewView }) {
  const change =
    view.score.change == null
      ? null
      : view.score.change > 0
        ? `+${view.score.change}`
        : view.score.change < 0
          ? `−${Math.abs(view.score.change)}`
          : "0"

  return (
    <section className="space-y-8">
      <div>
        <SectionLabel>Weekly Summary</SectionLabel>
        <h2 className="mt-4 text-[48px] leading-none font-semibold tracking-tight text-foreground sm:text-[64px]">
          {view.bounds.label}
        </h2>
        <p className="mt-3 text-[16px] text-muted-foreground">
          {view.bounds.rangeLabel}
        </p>
      </div>

      <div className="mc-surface-hero px-6 py-10 sm:px-10 sm:py-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground/70 uppercase">
              Overall Health Score
            </p>
            <p
              className={cn(
                "mt-3 text-[88px] leading-none font-semibold tracking-tight sm:text-[104px]",
                view.score.score == null
                  ? "text-muted-foreground/40"
                  : "text-foreground"
              )}
            >
              {view.score.score ?? "—"}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-10 gap-y-5">
            <div>
              <dt className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
                Change
              </dt>
              <dd
                className={cn(
                  "mt-2 text-[28px] font-medium tracking-tight tabular-nums",
                  view.score.change != null &&
                    view.score.change > 0 &&
                    "text-success",
                  view.score.change != null &&
                    view.score.change < 0 &&
                    "text-warning"
                )}
              >
                {change ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
                Confidence
              </dt>
              <dd className="mt-2 text-[28px] font-medium tracking-tight text-foreground">
                {view.score.confidence}
              </dd>
            </div>
          </dl>
        </div>

        <p className="mt-10 max-w-2xl text-[18px] leading-[1.85] text-foreground/85">
          {view.headline}
        </p>
      </div>
    </section>
  )
}

function BiggestWins({ wins }: { wins: WeeklyReviewView["wins"] }) {
  return (
    <section className="space-y-6">
      <SectionLabel>Biggest Wins</SectionLabel>
      {wins.length === 0 ? (
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          No standout wins detected for this week yet.
        </p>
      ) : (
        <ul className="space-y-4">
          {wins.map((win, index) => (
            <motion.li
              key={win.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transitions.fadeUp, delay: index * 0.03 }}
              className="flex items-start gap-3"
            >
              <Check
                className="mt-1 size-4 shrink-0 text-success"
                strokeWidth={2.5}
              />
              <span className="text-[17px] leading-relaxed text-foreground">
                {win.body}
              </span>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  )
}

function BodyCompositionSection({
  data,
}: {
  data: WeeklyReviewView["bodyComposition"]
}) {
  const chartConfig = useMemo(
    () =>
      ({
        weight: { label: "Weight", color: "var(--chart-1)" },
        bodyFat: { label: "Body fat", color: "var(--chart-2)" },
      }) satisfies ChartConfig,
    []
  )

  const chartData = useMemo(() => {
    const byDate = new Map<string, Record<string, string | number>>()
    const merge = (points: WeeklyChartPoint[], key: string) => {
      for (const point of points) {
        const row = byDate.get(point.date) ?? {
          date: point.date,
          label: point.label,
        }
        row[key] = point.value
        byDate.set(point.date, row)
      }
    }
    merge(data.weightSeries, "weight")
    merge(data.bodyFatSeries, "bodyFat")
    return [...byDate.values()].sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    )
  }, [data])

  return (
    <section className="space-y-8">
      <div>
        <SectionLabel>Body Composition</SectionLabel>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Weekly change and direction — charts only where they clarify the
          trend.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3">
        {data.metrics.map((metric) => (
          <div key={metric.id}>
            <dt className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
              {metric.label}
            </dt>
            <dd className="mt-2 text-[26px] font-medium tracking-tight text-foreground tabular-nums">
              {metric.value}
            </dd>
            {metric.delta ? (
              <p
                className={cn(
                  "mt-1.5 text-[13px] tabular-nums",
                  metric.improving === true && "text-success",
                  metric.improving === false && "text-warning",
                  metric.improving == null && "text-muted-foreground"
                )}
              >
                {metric.delta}
              </p>
            ) : null}
          </div>
        ))}
      </dl>

      {chartData.length >= 2 ? (
        <div className="mc-surface-hero px-4 py-6 sm:px-6">
          <ChartContainer config={chartConfig} className="aspect-[16/7] w-full">
            <LineChart data={chartData} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={36}
                tickMargin={4}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="var(--color-weight)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="bodyFat"
                stroke="var(--color-bodyFat)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </div>
      ) : null}

      {data.goalHints.length > 0 ? (
        <ul className="max-w-xl space-y-2">
          {data.goalHints.map((hint) => (
            <li
              key={hint}
              className="text-[15px] leading-relaxed text-muted-foreground"
            >
              {hint}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function NarrativeBlock({
  label,
  lines,
  stats,
  extras,
}: {
  label: string
  lines: string[]
  stats: Array<{ label: string; value: string }>
  extras?: ReactNode
}) {
  return (
    <section className="space-y-8">
      <SectionLabel>{label}</SectionLabel>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
              {stat.label}
            </dt>
            <dd className="mt-2 text-[22px] font-medium tracking-tight text-foreground tabular-nums">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
      {lines.length > 0 ? (
        <div className="max-w-2xl space-y-3">
          {lines.map((line) => (
            <p
              key={line}
              className="text-[16px] leading-relaxed text-foreground/90"
            >
              {line}
            </p>
          ))}
        </div>
      ) : null}
      {extras}
    </section>
  )
}

function SimpleNarrative({
  label,
  lines,
}: {
  label: string
  lines: string[]
}) {
  return (
    <section className="space-y-5">
      <SectionLabel>{label}</SectionLabel>
      <div className="max-w-2xl space-y-3">
        {lines.map((line) => (
          <p
            key={line}
            className="text-[16px] leading-relaxed text-foreground/90"
          >
            {line}
          </p>
        ))}
      </div>
    </section>
  )
}

function HealthStorySection({
  story,
}: {
  story: WeeklyReviewView["story"]
}) {
  return (
    <section className="space-y-8">
      <div>
        <SectionLabel>Health Story</SectionLabel>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          What happened, why it may have happened, and how systems interacted —
          with confidence, never certainty.
        </p>
      </div>
      {story.length === 0 ? (
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Not enough intersecting signals this week to write a confident story.
        </p>
      ) : (
        <div className="max-w-2xl space-y-8">
          {story.map((paragraph, index) => (
            <motion.article
              key={paragraph.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transitions.fadeUp, delay: index * 0.04 }}
              className="space-y-2"
            >
              <p className="text-[17px] leading-[1.75] text-foreground/90">
                {paragraph.body}
              </p>
              <p className="text-[12px] tracking-[0.08em] text-muted-foreground/70 uppercase">
                {paragraph.confidence} confidence
              </p>
            </motion.article>
          ))}
        </div>
      )}
    </section>
  )
}

function WhatChangedSection({
  positive,
  negative,
}: {
  positive: WeeklyReviewView["positiveChanges"]
  negative: WeeklyReviewView["negativeChanges"]
}) {
  return (
    <section className="space-y-8">
      <SectionLabel>What Changed?</SectionLabel>
      <div className="grid gap-12 sm:grid-cols-2">
        <ChangeList title="Positive" items={positive} tone="good" />
        <ChangeList title="Negative" items={negative} tone="bad" />
      </div>
    </section>
  )
}

function ChangeList({
  title,
  items,
  tone,
}: {
  title: string
  items: WeeklyReviewView["positiveChanges"]
  tone: "good" | "bad"
}) {
  return (
    <div>
      <p className="text-[13px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-4 text-[15px] text-muted-foreground">None ranked.</p>
      ) : (
        <ul className="mt-5 space-y-5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-baseline justify-between gap-4"
            >
              <span className="text-[15px] text-muted-foreground">
                {item.label}
              </span>
              <span
                className={cn(
                  "text-[24px] font-medium tracking-tight tabular-nums",
                  tone === "good" ? "text-success" : "text-warning"
                )}
              >
                {item.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FocusSection({ items }: { items: WeeklyReviewView["focus"] }) {
  return (
    <section className="space-y-8">
      <div>
        <SectionLabel>Focus for Next Week</SectionLabel>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          No more than five priorities — each with a reason.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="text-[15px] text-muted-foreground">
          Hold the current approach — no urgent pivots this week.
        </p>
      ) : (
        <ol className="max-w-2xl space-y-8">
          {items.map((item, index) => (
            <li key={item.id} className="space-y-2">
              <p className="text-[18px] font-medium tracking-tight text-foreground">
                <span className="mr-3 text-muted-foreground/60">
                  {index + 1}.
                </span>
                {item.body}
              </p>
              <p className="pl-7 text-[14px] leading-relaxed text-muted-foreground">
                {item.why}{" "}
                <span className="text-muted-foreground/60">
                  · {item.confidence} confidence
                </span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function ForecastSection({
  items,
}: {
  items: WeeklyReviewView["forecast"]
}) {
  return (
    <section className="space-y-8">
      <SectionLabel>Next Week Forecast</SectionLabel>
      <ul className="max-w-2xl space-y-7">
        {items.map((item) => (
          <li key={item.id} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-[16px] font-medium text-foreground">
                {item.label}
              </p>
              <p className="text-[11px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                {item.confidence}
              </p>
            </div>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              {item.projection}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function CoachNote({ note }: { note: string }) {
  return (
    <section className="space-y-5 pb-16">
      <SectionLabel>Coach&apos;s Note</SectionLabel>
      <p className="max-w-2xl text-[18px] leading-[1.85] text-foreground/90">
        {note}
      </p>
    </section>
  )
}
