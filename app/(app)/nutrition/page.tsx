import type { Metadata } from "next"

import { NutritionWorkspace } from "@/components/nutrition/nutrition-workspace"

export const metadata: Metadata = {
  title: "Nutrition — Geoffit",
  description:
    "Nutrition analytics — calories, macros, adherence, and trends over time.",
}

export default function NutritionPage() {
  return <NutritionWorkspace />
}
