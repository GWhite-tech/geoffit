/**
 * Classify Apple Health / Hevy activity strings into WorkoutCategory.
 */

import type { WorkoutCategory } from "@/lib/domain/workout"

const STRENGTH_PATTERNS = [
  /traditionalstrength/i,
  /functionalstrength/i,
  /strength/i,
  /weightlifting/i,
  /weight_training/i,
  /weighttraining/i,
  /cross.?training/i,
  /highintensityinterval/i,
  /hiit/i,
  /core.?training/i,
  /flexibility/i,
  /yoga/i,
  /pilates/i,
  /martial/i,
  /boxing/i,
  /kickboxing/i,
  /barbell/i,
  /dumbbell/i,
  /hevy/i,
]

const CATEGORY_PATTERNS: Array<{ category: WorkoutCategory; pattern: RegExp }> =
  [
    { category: "running", pattern: /run|jogging/i },
    { category: "walking", pattern: /walk/i },
    { category: "treadmill", pattern: /treadmill/i },
    {
      category: "cycling",
      pattern: /cycl|bike|spinning|hand.?cycling/i,
    },
    { category: "swimming", pattern: /swim/i },
    { category: "golf", pattern: /golf/i },
    { category: "hiking", pattern: /hik/i },
    { category: "rowing", pattern: /row/i },
  ]

/**
 * Map raw activity type / title to a Geoffit workout category.
 */
export function classifyWorkoutActivity(
  activityType: string,
  name?: string
): WorkoutCategory {
  const haystack = `${activityType} ${name ?? ""}`.trim()
  if (!haystack) return "other"

  for (const { category, pattern } of CATEGORY_PATTERNS) {
    if (pattern.test(haystack)) return category
  }
  if (STRENGTH_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return "strength"
  }
  return "other"
}

export function isStrengthCategory(category: WorkoutCategory): boolean {
  return category === "strength"
}

export function isCardioCategory(category: WorkoutCategory): boolean {
  return category !== "strength"
}

/** Categories that may merge with each other when times overlap. */
export function categoriesCompatible(
  a: WorkoutCategory,
  b: WorkoutCategory
): boolean {
  if (a === b) return true
  // Treadmill ↔ running are often the same session mirrored across apps.
  if (
    (a === "running" && b === "treadmill") ||
    (a === "treadmill" && b === "running")
  ) {
    return true
  }
  // Strength never merges with cardio.
  if (isStrengthCategory(a) !== isStrengthCategory(b)) return false
  return false
}
