/**
 * WorkoutSourcePriority — per-category connector ranking.
 *
 * Strength prefers Hevy; cardio prefers Apple Health.
 * Future connectors slot into these lists without redesigning merge.
 */

import type { WorkoutCategory, WorkoutSourceId } from "@/lib/domain/workout"
import { isStrengthCategory } from "./classify"

/**
 * Highest priority first.
 * Future: Strong, Garmin, Polar, Wahoo, Manual land in these lists.
 */
export const WORKOUT_SOURCE_PRIORITIES: Record<
  WorkoutCategory,
  WorkoutSourceId[]
> = {
  strength: ["hevy", "strong", "manual", "apple_health"],
  running: ["apple_health", "garmin", "polar", "manual"],
  walking: ["apple_health", "garmin", "polar", "manual"],
  treadmill: ["apple_health", "garmin", "polar", "manual"],
  cycling: ["apple_health", "garmin", "wahoo", "manual"],
  swimming: ["apple_health", "garmin", "polar", "manual"],
  golf: ["apple_health", "garmin", "manual"],
  hiking: ["apple_health", "garmin", "polar", "manual"],
  rowing: ["apple_health", "garmin", "manual"],
  other: ["apple_health", "hevy", "garmin", "manual"],
}

/** Sources trusted for exercise / set structure. */
export const STRUCTURE_SOURCE_ORDER: WorkoutSourceId[] = [
  "hevy",
  "strong",
  "manual",
  "apple_health",
]

/** Sources trusted for calories, HR, distance, GPS, VO₂. */
export const PHYSIOLOGY_SOURCE_ORDER: WorkoutSourceId[] = [
  "apple_health",
  "garmin",
  "polar",
  "wahoo",
  "manual",
  "hevy",
]

export function priorityIndex(
  category: WorkoutCategory,
  source: WorkoutSourceId
): number {
  const list = WORKOUT_SOURCE_PRIORITIES[category]
  const index = list.indexOf(source)
  return index === -1 ? list.length + 10 : index
}

export function compareSourcePriority(
  category: WorkoutCategory,
  a: WorkoutSourceId,
  b: WorkoutSourceId
): number {
  return priorityIndex(category, a) - priorityIndex(category, b)
}

export function primarySourceForCategory(
  category: WorkoutCategory
): WorkoutSourceId {
  return WORKOUT_SOURCE_PRIORITIES[category][0] ?? "apple_health"
}

export function structureOwnerOrder(
  category: WorkoutCategory
): WorkoutSourceId[] {
  if (isStrengthCategory(category)) {
    return STRUCTURE_SOURCE_ORDER
  }
  // Cardio: name/notes may still come from a logging app if present,
  // but physiology sources win for analytics — structure order still
  // prefers dedicated loggers when they exist.
  return ["hevy", "strong", "manual", "apple_health", "garmin"]
}

export function physiologyOwnerOrder(
  _category: WorkoutCategory
): WorkoutSourceId[] {
  return PHYSIOLOGY_SOURCE_ORDER
}
