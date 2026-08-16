/**
 * Aggregate HealthStore dietary quantity samples into NutritionDay totals.
 * No seed / mock data — empty if no dietary imports exist.
 */

import {
  isDietaryHealthMetric,
  type DietaryHealthMetricType,
  type HealthRecord,
  type QuantityHealthRecord,
} from "@/lib/domain/health"
import type { NutritionDay, NutritionSource } from "@/lib/domain/nutrition"

/**
 * Calendar day for Apple Health nutrition rollups.
 * Preserves existing semantics: first 10 chars of the ISO startDate string
 * (Apple Health mapper stores UTC via `toISOString()`, so this is the UTC date).
 */
export function nutritionDayKeyFromStartDate(iso: string): string {
  return iso.slice(0, 10)
}

function dayKey(iso: string): string {
  return nutritionDayKeyFromStartDate(iso)
}

/**
 * UTC inclusive window matching `nutritionDayKeyFromStartDate` for ISO-Z timestamps.
 * Do not replace with a local-timezone day boundary.
 */
export function nutritionDayUtcBounds(date: string): {
  startAt: string
  endAt: string
} {
  return {
    startAt: `${date}T00:00:00.000Z`,
    endAt: `${date}T23:59:59.999Z`,
  }
}

/** Dates touched by dietary quantity samples in this record set (sorted). */
export function dietaryDayKeysFromHealthRecords(
  records: HealthRecord[]
): string[] {
  const keys = new Set<string>()
  for (const record of dietaryRecordsFromHealth(records)) {
    keys.add(dayKey(record.startDate))
  }
  return [...keys].sort()
}

/** Clinical equality for nutrition_day rows — not fingerprint identity. */
export function nutritionDaysClinicallyEqual(
  a: Pick<
    NutritionDay,
    | "date"
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
  >,
  b: Pick<
    NutritionDay,
    | "date"
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
  >
): boolean {
  return (
    a.date === b.date &&
    a.calories === b.calories &&
    a.protein === b.protein &&
    a.carbohydrates === b.carbohydrates &&
    a.fat === b.fat &&
    a.fibre === b.fibre &&
    a.water === b.water &&
    (a.sugar ?? 0) === (b.sugar ?? 0) &&
    (a.sodium ?? 0) === (b.sodium ?? 0) &&
    (a.alcohol ?? 0) === (b.alcohol ?? 0) &&
    (a.caffeine ?? 0) === (b.caffeine ?? 0)
  )
}

/** Convert a raw HealthKit sample into the unit used on NutritionDay. */
export function normalizeDietaryValue(
  type: DietaryHealthMetricType,
  value: number,
  unit: string
): number {
  const u = unit.trim().toLowerCase()

  switch (type) {
    case "dietary_energy": {
      if (u === "kj" || u.includes("kj")) return value / 4.184
      if (u === "j" || u === "joule" || u === "joules") return value / 4184
      // kcal / Cal / large calorie
      return value
    }
    case "dietary_water": {
      if (u === "l" || u === "liter" || u === "litre" || u === "liters") {
        return value
      }
      if (u === "ml" || u === "mL".toLowerCase()) return value / 1000
      if (u.includes("fl") || u === "cup") return value * 0.0295735
      // Apple often stores water as mL without clear unit — treat large values as mL
      if (!u && value > 20) return value / 1000
      return value > 20 ? value / 1000 : value
    }
    case "dietary_sodium":
    case "dietary_caffeine": {
      if (u === "g" || u === "gram" || u === "grams") return value * 1000
      return value // mg
    }
    case "dietary_protein":
    case "dietary_carbohydrates":
    case "dietary_fat":
    case "dietary_fibre":
    case "dietary_sugar": {
      if (u === "mg") return value / 1000
      return value // g
    }
    case "dietary_alcohol":
      return value // drinks / count
    default:
      return value
  }
}

type DietaryQuantityRecord = QuantityHealthRecord & {
  type: DietaryHealthMetricType
}

function isDietaryQuantity(
  record: HealthRecord
): record is DietaryQuantityRecord {
  return (
    "value" in record &&
    typeof record.value === "number" &&
    isDietaryHealthMetric(record.type)
  )
}

export function dietaryRecordsFromHealth(
  records: HealthRecord[]
): DietaryQuantityRecord[] {
  return records.filter(isDietaryQuantity)
}

export function buildNutritionDaysFromHealthRecords(
  records: HealthRecord[]
): NutritionDay[] {
  const dietary = dietaryRecordsFromHealth(records)
  if (dietary.length === 0) return []

  type Acc = {
    calories: number
    protein: number
    carbohydrates: number
    fat: number
    fibre: number
    water: number
    sugar: number
    sodium: number
    alcohol: number
    caffeine: number
    sources: Set<string>
  }

  const byDate = new Map<string, Acc>()

  for (const record of dietary) {
    const date = dayKey(record.startDate)
    const acc =
      byDate.get(date) ??
      ({
        calories: 0,
        protein: 0,
        carbohydrates: 0,
        fat: 0,
        fibre: 0,
        water: 0,
        sugar: 0,
        sodium: 0,
        alcohol: 0,
        caffeine: 0,
        sources: new Set<string>(),
      } satisfies Acc)

    const value = normalizeDietaryValue(
      record.type,
      record.value,
      record.unit
    )

    switch (record.type) {
      case "dietary_energy":
        acc.calories += value
        break
      case "dietary_protein":
        acc.protein += value
        break
      case "dietary_carbohydrates":
        acc.carbohydrates += value
        break
      case "dietary_fat":
        acc.fat += value
        break
      case "dietary_fibre":
        acc.fibre += value
        break
      case "dietary_water":
        acc.water += value
        break
      case "dietary_sugar":
        acc.sugar += value
        break
      case "dietary_sodium":
        acc.sodium += value
        break
      case "dietary_alcohol":
        acc.alcohol += value
        break
      case "dietary_caffeine":
        acc.caffeine += value
        break
    }

    acc.sources.add(record.sourceName || record.source || "apple_health")
    byDate.set(date, acc)
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, acc]) => {
      const sourceName = [...acc.sources][0]
      const source: NutritionSource =
        sourceName?.toLowerCase().includes("apple") ||
        [...acc.sources].some((s) => s === "apple_health")
          ? "apple_health"
          : "manual"

      return {
        id: `nutrition-${date}`,
        date,
        calories: Math.round(acc.calories),
        protein: Math.round(acc.protein * 10) / 10,
        carbohydrates: Math.round(acc.carbohydrates * 10) / 10,
        fat: Math.round(acc.fat * 10) / 10,
        fibre: Math.round(acc.fibre * 10) / 10,
        water: Math.round(acc.water * 100) / 100,
        sugar: Math.round(acc.sugar * 10) / 10,
        sodium: Math.round(acc.sodium),
        alcohol: Math.round(acc.alcohol * 10) / 10,
        caffeine: Math.round(acc.caffeine),
        source,
        sourceName,
        fingerprint: `nutrition:health:${date}`,
      } satisfies NutritionDay
    })
}
