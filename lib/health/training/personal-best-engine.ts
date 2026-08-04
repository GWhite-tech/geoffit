/**
 * PersonalBestEngine — likely PR opportunities (never certainty).
 */

import type { HealthRecord } from "@/lib/domain/health"
import type { Workout } from "@/lib/domain/workout"
import type { HevyWorkoutEntry } from "@/lib/health/workout"
import { buildExerciseHistories } from "@/lib/health/workout"

import { buildRecoveryReadiness } from "./recovery-readiness-engine"
import type { PersonalBestOpportunity } from "./types"

export function buildPersonalBestOpportunities(
  workouts: Workout[],
  hevyWorkouts: HevyWorkoutEntry[],
  records: HealthRecord[]
): PersonalBestOpportunity[] {
  const readiness = buildRecoveryReadiness(workouts, records)
  const histories = buildExerciseHistories(hevyWorkouts)
  const opportunities: PersonalBestOpportunity[] = []

  for (const history of histories) {
    if (history.sessionCount < 4) continue
    const recent = history.sessions.slice(-4)
    const last = recent[recent.length - 1]
    if (!last) continue

    const values = recent
      .map((session) => session.bestEstimated1RmKg)
      .filter((value): value is number => value != null && value > 0)
    if (values.length < 3) continue

    const trendUp = values[values.length - 1]! >= values[0]! * 0.98
    const daysSince = Math.floor(
      (Date.now() - Date.parse(last.startDate)) / 86_400_000
    )
    if (daysSince > 21) continue
    if (!trendUp && readiness.band !== "ready") continue

    const lastWeight = last.bestWeightKg
    const lastReps = last.sets
      .filter((set) => set.weightKg === lastWeight && set.reps != null)
      .map((set) => set.reps as number)
      .sort((a, b) => b - a)[0]

    let chance: PersonalBestOpportunity["chance"] = "Low"
    if (readiness.band === "ready" && trendUp && daysSince >= 2) chance = "High"
    else if (readiness.band !== "recovery_recommended" && trendUp) chance = "Medium"

    const targetWeight =
      lastWeight != null ? Math.round((lastWeight + 2) * 2) / 2 : null
    const targetReps = lastReps ?? 8

    opportunities.push({
      id: history.key,
      exerciseName: history.name,
      chance,
      lastAttempt:
        lastWeight != null && lastReps != null
          ? `${lastWeight} kg × ${lastReps}`
          : lastWeight != null
            ? `${lastWeight} kg`
            : null,
      recommendedTarget:
        targetWeight != null ? `${targetWeight} kg × ${targetReps}` : null,
      why:
        readiness.band === "ready"
          ? "Recovery is supportive and recent attempts are close to prior bests."
          : "Recent loading suggests a measured attempt may be productive.",
    })
  }

  const rank = { High: 3, Medium: 2, Low: 1 }
  return opportunities
    .sort((a, b) => rank[b.chance] - rank[a.chance])
    .slice(0, 5)
}

export const PersonalBestEngine = {
  build: buildPersonalBestOpportunities,
} as const
