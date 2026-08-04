/**
 * ProgrammeHealthEngine — on track / behind / recovery limited status.
 */

import type { ProgrammeAnalytics } from "./coaching-types"
import type {
  AdaptiveProgressionAdvice,
  ProgrammeHealthResult,
} from "./coaching-types"

export function buildProgrammeHealth(input: {
  analytics: ProgrammeAnalytics
  adaptive: AdaptiveProgressionAdvice[]
  recoveryScore: number | null
}): ProgrammeHealthResult {
  const { analytics, adaptive, recoveryScore } = input

  if (adaptive.some((item) => item.action === "schedule_deload")) {
    return {
      status: "deload_recommended",
      label: "Deload Recommended",
      detail:
        "Load and recovery together suggest protecting adaptation with a lighter week.",
    }
  }

  if (recoveryScore != null && recoveryScore < 45) {
    return {
      status: "recovery_limited",
      label: "Recovery Limited",
      detail:
        "Programme progress is constrained by recovery signals more than by session design.",
    }
  }

  const completion = analytics.completionPct
  if (completion != null && completion >= 95 && analytics.missedSessions === 0) {
    return {
      status: "ahead",
      label: "Ahead of Plan",
      detail: "Completion and coverage are ahead of the expected block pace.",
    }
  }

  if (completion != null && completion < 65) {
    return {
      status: "slightly_behind",
      label: "Slightly Behind",
      detail:
        "Matched sessions are lagging the planned block — prioritise the next planned workout.",
    }
  }

  return {
    status: "on_track",
    label: "On Track",
    detail:
      "The block is progressing in line with planned sessions and recovery context.",
  }
}

export const ProgrammeHealthEngine = {
  build: buildProgrammeHealth,
} as const
