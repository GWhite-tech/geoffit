/**
 * Geoffit nutrition domain — daily totals from any source.
 * Meal-level data is optional; analytics work from day aggregates alone.
 */

export type NutritionSource =
  | "apple_health"
  | "myfitnesspal"
  | "cronometer"
  | "yazio"
  | "macrofactor"
  | "csv"
  | "manual"
  | "seed"

export type NutritionMacroId =
  | "calories"
  | "protein"
  | "carbohydrates"
  | "fat"
  | "fibre"
  | "water"
  | "sugar"
  | "sodium"
  | "alcohol"
  | "caffeine"

export interface NutritionTargets {
  calories: number
  protein: number
  carbohydrates: number
  fat: number
  fibre: number
  /** Litres */
  water: number
}

export interface NutritionMeal {
  id: string
  name: string
  /** breakfast | lunch | dinner | snack | other */
  slot: "breakfast" | "lunch" | "dinner" | "snack" | "other"
  time?: string
  calories?: number
  protein?: number
  carbohydrates?: number
  fat?: number
}

/** One calendar day of nutrition totals. */
export interface NutritionDay {
  id: string
  /** YYYY-MM-DD */
  date: string
  calories: number
  protein: number
  carbohydrates: number
  fat: number
  fibre: number
  /** Litres */
  water: number
  sugar?: number
  sodium?: number
  alcohol?: number
  caffeine?: number
  meals?: NutritionMeal[]
  source: NutritionSource
  sourceName?: string
  fingerprint: string
}

export const DEFAULT_NUTRITION_TARGETS: NutritionTargets = {
  calories: 2200,
  protein: 220,
  carbohydrates: 200,
  fat: 70,
  fibre: 30,
  water: 3.5,
}

export const NUTRITION_MACRO_LABELS: Record<NutritionMacroId, string> = {
  calories: "Calories",
  protein: "Protein",
  carbohydrates: "Carbs",
  fat: "Fat",
  fibre: "Fibre",
  water: "Water",
  sugar: "Sugar",
  sodium: "Sodium",
  alcohol: "Alcohol",
  caffeine: "Caffeine",
}
