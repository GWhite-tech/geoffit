/**
 * Estimated 1RM helpers — Epley formula for working sets.
 */

/** Epley: 1RM ≈ w × (1 + r/30). Valid for 1–12 reps typically. */
export function estimateOneRepMaxKg(
  weightKg: number,
  reps: number
): number | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null
  if (!Number.isFinite(reps) || reps < 1) return null
  if (reps === 1) return round1(weightKg)
  if (reps > 12) return null
  return round1(weightKg * (1 + reps / 30))
}

export function isWorkingSet(setType?: string | null): boolean {
  if (!setType) return true
  const normalized = setType.trim().toLowerCase()
  return normalized !== "warmup" && normalized !== "warm-up"
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}
