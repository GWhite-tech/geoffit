/**
 * WorkoutRecommendationEngine — single next-best session for today.
 * Prefers the active structured programme session when available.
 */

import type { HealthRecord } from "@/lib/domain/health"
import type { Workout } from "@/lib/domain/workout"
import type { PlannedNextSession } from "@/lib/health/programme"
import { latestHrv, latestSleep } from "@/lib/health/selectors"

import { classifyMuscleGroup } from "./muscle-groups"
import { inLastDays } from "./period"
import { buildProgrammeAdherence } from "./programme-engine"
import { buildRecoveryReadiness } from "./recovery-readiness-engine"
import { StrengthEngine } from "./strength-engine"
import { buildVolumePlanner } from "./volume-planner-engine"
import type {
  NextBestSession,
  NextBestSessionKind,
  TrainingGoals,
} from "./types"

function daysSinceMuscle(
  workouts: Workout[],
  groups: Set<string>
): number | null {
  const strength = StrengthEngine.strengthSessions(workouts)
  let latest: number | null = null
  for (const workout of strength) {
    for (const exercise of workout.exercises ?? []) {
      const group = classifyMuscleGroup(exercise.name)
      if (!groups.has(group)) continue
      const time = Date.parse(workout.startDate)
      if (Number.isNaN(time)) continue
      if (latest == null || time > latest) latest = time
    }
  }
  if (latest == null) return null
  return Math.floor((Date.now() - latest) / 86_400_000)
}

function daysSinceLabel(workouts: Workout[], pattern: RegExp): number | null {
  const strength = StrengthEngine.strengthSessions(workouts)
  let latest: number | null = null
  for (const workout of strength) {
    if (!pattern.test(workout.name)) continue
    const time = Date.parse(workout.startDate)
    if (Number.isNaN(time)) continue
    if (latest == null || time > latest) latest = time
  }
  if (latest == null) return null
  return Math.floor((Date.now() - latest) / 86_400_000)
}

function kindFromSessionName(name: string): NextBestSessionKind {
  const lower = name.toLowerCase()
  if (/rest/.test(lower)) return "rest"
  if (/walk|recovery/.test(lower)) return "recovery_walk"
  if (/zone\s*2|cardio/.test(lower)) return "zone2"
  if (/push/.test(lower)) return "push"
  if (/pull/.test(lower)) return "pull"
  if (/leg/.test(lower)) return "legs"
  if (/lower/.test(lower)) return "lower"
  if (/upper|full body/.test(lower)) return "upper"
  return "upper"
}

export function buildNextBestSession(
  workouts: Workout[],
  records: HealthRecord[],
  goals: TrainingGoals,
  planned?: PlannedNextSession | null
): NextBestSession {
  const readiness = buildRecoveryReadiness(workouts, records)
  const sleep = latestSleep(records)
  const hrv = latestHrv(records)

  if (
    readiness.band === "recovery_recommended" ||
    (sleep && sleep.durationMinutes < 5.5 * 60)
  ) {
    const kind =
      readiness.score != null && readiness.score < 35 ? "rest" : "recovery_walk"
    return {
      kind,
      title: kind === "rest" ? "Rest Day" : "Recovery Walk",
      confidence: "Medium",
      why: [
        readiness.band === "recovery_recommended"
          ? "Recovery markers suggest easing intensity today."
          : "Recent sleep is below a productive training threshold.",
        planned
          ? `Defer ${planned.session.name} from ${planned.programmeName} until readiness improves.`
          : "Skip structural loading until recovery improves.",
        ...(hrv ? [`Latest HRV reads ${Math.round(hrv.value)} ms.`] : []),
      ],
      avoid: "Avoid stacking another high-load strength session today.",
      fromProgramme: Boolean(planned),
      programmeId: planned?.programmeId ?? null,
      programmeSessionId: planned?.session.id ?? null,
    }
  }

  // Structured programme wins over generic heuristics
  if (planned) {
    const why = [
      planned.reason,
      readiness.band === "ready"
        ? "Recovery supports completing the planned session."
        : "Recovery is acceptable for the planned session with honest intensity.",
      `Week ${planned.weekNumber}${planned.isDeload ? " (deload)" : ""} · ${planned.session.exercises.length} planned exercises.`,
    ]
    if (planned.session.focus) why.push(planned.session.focus)
    return {
      kind: kindFromSessionName(planned.session.name),
      title: planned.session.name,
      why,
      confidence: readiness.band === "ready" ? "High" : "Medium",
      avoid: planned.isDeload
        ? "Deload week — keep loads moderate even if energy feels high."
        : null,
      fromProgramme: true,
      programmeId: planned.programmeId,
      programmeSessionId: planned.session.id,
    }
  }

  const volume = buildVolumePlanner(workouts, goals)
  const programme = buildProgrammeAdherence(workouts)
  const weekStrength = StrengthEngine.strengthSessions(inLastDays(workouts, 7))

  const lowerDays =
    daysSinceMuscle(
      workouts,
      new Set(["quads", "hamstrings", "glutes", "calves", "legs"])
    ) ?? daysSinceLabel(workouts, /lower|leg/i)
  const upperDays =
    daysSinceMuscle(
      workouts,
      new Set(["chest", "back", "shoulders", "arms"])
    ) ?? daysSinceLabel(workouts, /upper|push|pull|chest|back/i)
  const pushDays = daysSinceLabel(workouts, /push/i)
  const pullDays = daysSinceLabel(workouts, /pull/i)

  const chest = volume.rows.find((row) => row.id === "chest")
  const back = volume.rows.find((row) => row.id === "back")
  const quads = volume.rows.find((row) => row.id === "quads")
  const hamstrings = volume.rows.find((row) => row.id === "hamstrings")

  const why: string[] = []
  let kind: NextBestSessionKind = "upper"
  let title = "Upper Body"
  let confidence: NextBestSession["confidence"] = "Medium"
  let avoid: string | null = null

  const lowerRemaining =
    (quads?.remaining ?? 0) +
    (hamstrings?.remaining ?? 0) +
    (volume.rows.find((r) => r.id === "glutes")?.remaining ?? 0)
  const upperRemaining =
    (chest?.remaining ?? 0) +
    (back?.remaining ?? 0) +
    (volume.rows.find((r) => r.id === "shoulders")?.remaining ?? 0)

  const prefersPpl = programme.plannedPattern.some((item) =>
    /push|pull|leg/i.test(item)
  )

  if (
    lowerRemaining >= upperRemaining &&
    (lowerDays == null || lowerDays >= 3) &&
    !(quads?.complete && hamstrings?.complete)
  ) {
    if (prefersPpl) {
      kind = "legs"
      title = "Legs"
    } else {
      kind = "lower"
      title = "Lower Body"
    }
    confidence =
      readiness.band === "ready" && (lowerDays ?? 0) >= 4 ? "High" : "Medium"
    if (readiness.band === "ready") why.push("Recovery is high.")
    if (lowerDays != null) {
      why.push(
        `Legs have recovered for ${lowerDays} day${lowerDays === 1 ? "" : "s"}.`
      )
    }
    if (chest?.complete) why.push("Chest volume is already at or above target.")
    why.push(
      `A ${title} session is likely to provide the greatest training benefit today.`
    )
    if (upperDays != null && upperDays <= 1) {
      avoid = "Upper body was trained recently — prefer lower today."
    }
  } else if (
    prefersPpl &&
    (pushDays == null || (pullDays != null && pushDays >= pullDays))
  ) {
    kind = "push"
    title = "Push"
    confidence = readiness.band === "ready" ? "High" : "Medium"
    if (readiness.band === "ready") why.push("Recovery is supportive.")
    if (pushDays != null) why.push(`Last Push session was ${pushDays} days ago.`)
    why.push("A Push session fits your inferred programme and current freshness.")
  } else if (prefersPpl && (pullDays == null || pullDays >= 2)) {
    kind = "pull"
    title = "Pull"
    confidence = readiness.band === "ready" ? "High" : "Medium"
    if (readiness.band === "ready") why.push("Recovery is supportive.")
    if (pullDays != null) why.push(`Last Pull session was ${pullDays} days ago.`)
    if (back && !back.complete) {
      why.push(`Back still has ${back.remaining} sets remaining this week.`)
    }
    why.push("A Pull session is likely the highest-impact choice today.")
  } else if (upperRemaining > 0 || (upperDays ?? 99) >= 2) {
    kind = "upper"
    title = "Upper Body"
    confidence = readiness.band === "ready" ? "High" : "Medium"
    if (readiness.band === "ready") why.push("Recovery is high.")
    if (upperDays != null) {
      why.push(`Upper body last trained ${upperDays} days ago.`)
    }
    why.push(
      "An Upper Body session is likely to provide the greatest training benefit today."
    )
  } else if (weekStrength.length >= goals.strengthSessionsPerWeek) {
    kind = "zone2"
    title = "Zone 2 Cardio"
    confidence = "Medium"
    why.push("Weekly strength target is already covered.")
    why.push("Zone 2 work can improve fitness without heavy structural load.")
  } else {
    kind = "zone2"
    title = "Zone 2 Cardio"
    confidence = "Low"
    why.push("Mixed signals across recovery and muscle freshness.")
    why.push("A low-intensity cardio session is a safe high-value default.")
  }

  if (why.length === 0) {
    why.push("Based on recovery, recent load, and weekly volume gaps.")
  }

  return {
    kind,
    title,
    why,
    confidence,
    avoid,
    fromProgramme: false,
    programmeId: null,
    programmeSessionId: null,
  }
}

export const WorkoutRecommendationEngine = {
  build: buildNextBestSession,
} as const
