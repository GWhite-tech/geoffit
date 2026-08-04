"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Cell, Pie, PieChart } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { SectionLabel } from "@/components/ui/section-label"
import {
  formatGrams,
  formatKcal,
  formatLitres,
  useNutritionDay,
} from "@/lib/health/nutrition"
import { transitions } from "@/lib/theme"

const pieConfig = {
  protein: { label: "Protein", color: "var(--primary)" },
  carbohydrates: { label: "Carbs", color: "var(--chart-2)" },
  fat: { label: "Fat", color: "var(--chart-3)" },
} satisfies ChartConfig

export function NutritionDayDetail({ date }: { date: string }) {
  const { day, targets } = useNutritionDay(date)

  if (!day) {
    return (
      <div className="mx-auto max-w-[880px] px-6 py-12">
        <p className="text-[15px] text-muted-foreground">
          No nutrition data for {date}.
        </p>
        <Link href="/nutrition" className="mt-4 inline-block text-primary">
          Back to nutrition
        </Link>
      </div>
    )
  }

  const pieData = [
    { key: "protein", name: "Protein", value: day.protein * 4 },
    { key: "carbohydrates", name: "Carbs", value: day.carbohydrates * 4 },
    { key: "fat", name: "Fat", value: day.fat * 9 },
  ]

  const meals = day.meals ?? []

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[880px] flex-col gap-10 px-6 py-10 lg:px-10">
      <div>
        <Link
          href="/nutrition"
          className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Nutrition
        </Link>
        <SectionLabel className="mt-6">Day detail</SectionLabel>
        <h1 className="mt-3 text-[34px] font-semibold tracking-tight text-foreground">
          {date}
        </h1>
        <p className="mt-3 text-[28px] font-medium tracking-tight text-foreground">
          {formatKcal(day.calories)}
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.fadeUp}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        <Stat label="Protein" value={formatGrams(day.protein)} />
        <Stat label="Carbs" value={formatGrams(day.carbohydrates)} />
        <Stat label="Fat" value={formatGrams(day.fat)} />
        <Stat label="Fibre" value={formatGrams(day.fibre)} />
        <Stat label="Water" value={formatLitres(day.water)} />
        <Stat
          label="vs target"
          value={`${Math.round((day.calories / targets.calories) * 100)}%`}
        />
      </motion.div>

      <section className="space-y-4">
        <SectionLabel>Macro split</SectionLabel>
        <div className="mc-surface-hero px-4 py-6 sm:px-8 sm:py-8">
          <ChartContainer
            config={pieConfig}
            className="mx-auto aspect-square max-h-[280px] w-full max-w-[280px]"
            initialDimension={{ width: 280, height: 280 }}
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={70}
                outerRadius={110}
                strokeWidth={0}
                isAnimationActive
              >
                {pieData.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={`var(--color-${entry.key})`}
                  />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-[13px] text-muted-foreground">
            <span>Protein {formatGrams(day.protein)}</span>
            <span>Carbs {formatGrams(day.carbohydrates)}</span>
            <span>Fat {formatGrams(day.fat)}</span>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionLabel>Meal timeline</SectionLabel>
        {meals.length === 0 ? (
          <div className="mc-card px-5 py-6 text-[15px] text-muted-foreground">
            Daily totals only — no meal-level data for this day.
          </div>
        ) : (
          <ul className="mc-card divide-y divide-border/25">
            {meals.map((meal) => (
              <li
                key={meal.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div>
                  <p className="text-[15px] font-medium text-foreground">
                    {meal.name}
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground capitalize">
                    {meal.slot}
                    {meal.time ? ` · ${meal.time}` : ""}
                  </p>
                </div>
                <div className="text-right text-[13px] text-muted-foreground">
                  <p className="font-medium text-foreground">
                    {meal.calories != null
                      ? formatKcal(meal.calories)
                      : "—"}
                  </p>
                  <p className="mt-1">
                    {meal.protein != null
                      ? `${Math.round(meal.protein)}g P`
                      : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="mc-card px-4 py-4">
      <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground/70 uppercase">
        {label}
      </p>
      <p className="mt-2 text-[18px] font-medium tracking-tight text-foreground">
        {value}
      </p>
    </div>
  )
}
