/**
 * ProgrammeHistoryEngine — completed / archived blocks for comparison.
 */

import type { Programme } from "@/lib/domain/programme"
import { PROGRAMME_TYPE_LABELS } from "@/lib/domain/programme"

import type { ProgrammeHistoryItem } from "./coaching-types"

const GOAL_LABELS: Record<Programme["goal"], string> = {
  strength: "Strength",
  hypertrophy: "Hypertrophy",
  powerbuilding: "Powerbuilding",
  general_fitness: "General fitness",
  fat_loss: "Fat loss",
  custom: "Custom",
}

export function buildProgrammeHistory(
  programmes: Programme[]
): ProgrammeHistoryItem[] {
  return programmes
    .filter(
      (programme) =>
        programme.status === "completed" ||
        programme.status === "archived" ||
        programme.status === "active"
    )
    .map((programme) => ({
      id: programme.id,
      name: programme.name,
      goal: GOAL_LABELS[programme.goal] ?? programme.goal,
      type: PROGRAMME_TYPE_LABELS[programme.type],
      status: programme.status,
      startDate: programme.startDate,
      endDate: programme.endDate,
      weeks: programme.weeks.length,
      adherencePct: null,
      detail: `${PROGRAMME_TYPE_LABELS[programme.type]} · ${programme.weeks.length} weeks · ${programme.status}`,
    }))
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
}

export const ProgrammeHistoryEngine = {
  build: buildProgrammeHistory,
} as const
