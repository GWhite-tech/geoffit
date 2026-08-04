"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"

import { Input } from "@/components/ui/input"
import { SectionLabel } from "@/components/ui/section-label"
import type { NutritionTargets } from "@/lib/domain/nutrition"
import type { NutritionSummary } from "@/lib/health/nutrition"
import { setNutritionTargets } from "@/lib/health/nutrition"
import { transitions } from "@/lib/theme"

type TargetField = {
  key: keyof NutritionTargets
  label: string
  unit: string
  step: string
  detail: (today: NutritionSummary["today"], targets: NutritionTargets) => string | null
}

const FIELDS: TargetField[] = [
  {
    key: "calories",
    label: "Calorie target",
    unit: "kcal",
    step: "1",
    detail: (today, targets) =>
      today != null
        ? `${Math.round((today.calories / targets.calories) * 100)}% today`
        : null,
  },
  {
    key: "protein",
    label: "Protein target",
    unit: "g",
    step: "1",
    detail: (today, targets) =>
      today != null
        ? `${Math.round((today.protein / targets.protein) * 100)}% today`
        : null,
  },
  {
    key: "carbohydrates",
    label: "Carb target",
    unit: "g",
    step: "1",
    detail: () => null,
  },
  {
    key: "fat",
    label: "Fat target",
    unit: "g",
    step: "1",
    detail: () => null,
  },
  {
    key: "fibre",
    label: "Fibre target",
    unit: "g",
    step: "1",
    detail: () => null,
  },
  {
    key: "water",
    label: "Water target",
    unit: "L",
    step: "0.1",
    detail: (today) =>
      today != null ? `${today.water.toFixed(1)} L today` : null,
  },
]

function targetsToDraft(targets: NutritionTargets): Record<keyof NutritionTargets, string> {
  return {
    calories: String(targets.calories),
    protein: String(targets.protein),
    carbohydrates: String(targets.carbohydrates),
    fat: String(targets.fat),
    fibre: String(targets.fibre),
    water: String(targets.water),
  }
}

export function NutritionContextSidebar({
  summary,
}: {
  summary: NutritionSummary
}) {
  const { targets, today } = summary
  const [draft, setDraft] = useState(() => targetsToDraft(targets))

  useEffect(() => {
    setDraft(targetsToDraft(targets))
  }, [targets])

  function commitField(key: keyof NutritionTargets) {
    const parsed = Number(draft[key])
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(targetsToDraft(targets))
      return
    }
    const nextValue = key === "water" ? Math.round(parsed * 100) / 100 : Math.round(parsed)
    if (nextValue === targets[key]) {
      setDraft(targetsToDraft(targets))
      return
    }
    setNutritionTargets({ ...targets, [key]: nextValue })
  }

  return (
    <aside className="flex h-full w-full flex-col border-l border-border/30 px-5 pt-8 pb-8">
      <SectionLabel>Targets</SectionLabel>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
        Edit goals used for remaining calories, adherence, and daily target
        checks.
      </p>
      <ul className="mt-6 space-y-2.5">
        {FIELDS.map((field, index) => {
          const detail = field.detail(today, targets)
          return (
            <motion.li
              key={field.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transitions.fadeUp, delay: 0.04 + index * 0.03 }}
              className="mc-card px-4 py-3.5"
            >
              <label className="block space-y-2">
                <span className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground/70 uppercase">
                  {field.label}
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step={field.step}
                    value={draft[field.key]}
                    onChange={(event) => {
                      const value = event.target.value
                      setDraft((prev) => ({ ...prev, [field.key]: value }))
                    }}
                    onBlur={() => commitField(field.key)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur()
                      }
                    }}
                    className="h-10 border-border/40 bg-card/30 text-[18px] font-medium tracking-tight"
                  />
                  <span className="shrink-0 text-[13px] text-muted-foreground">
                    {field.unit}
                  </span>
                </div>
              </label>
              {detail ? (
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  {detail}
                </p>
              ) : null}
            </motion.li>
          )
        })}
      </ul>
    </aside>
  )
}
