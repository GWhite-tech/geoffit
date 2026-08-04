/**
 * Heuristic exercise → muscle group mapping for volume analysis.
 */

import type { MuscleGroupId } from "./types"

const RULES: Array<{ id: MuscleGroupId; pattern: RegExp }> = [
  { id: "chest", pattern: /bench|chest|push.?up|pec|fly|flies|dip/i },
  {
    id: "back",
    pattern: /row|pulldown|pull.?down|pull.?up|chin.?up|lat |deadlift|trap|face.?pull/i,
  },
  {
    id: "shoulders",
    pattern: /shoulder|ohp|overhead|military|lateral|rear delt|front raise/i,
  },
  {
    id: "quads",
    pattern: /squat|leg press|leg extension|lunge|split squat|hack squat/i,
  },
  {
    id: "hamstrings",
    pattern: /hamstring|leg curl|rdl|romanian|good morning/i,
  },
  { id: "glutes", pattern: /glute|hip thrust|kickback|abduct/i },
  { id: "calves", pattern: /calf|calves/i },
  {
    id: "arms",
    pattern: /curl|tricep|bicep|skull|pushdown|hammer|extension/i,
  },
  { id: "core", pattern: /crunch|plank|ab |abs|core|sit.?up|raise.*leg/i },
  { id: "legs", pattern: /leg |thigh/i },
]

export const MUSCLE_GROUP_LABELS: Record<MuscleGroupId, string> = {
  chest: "Chest",
  back: "Back",
  legs: "Legs",
  shoulders: "Shoulders",
  arms: "Arms",
  core: "Core",
  glutes: "Glutes",
  hamstrings: "Hamstrings",
  quads: "Quads",
  calves: "Calves",
  other: "Other",
}

/** Recommended weekly set ranges (approximate hypertrophy guidelines). */
export const MUSCLE_GROUP_TARGETS: Record<
  MuscleGroupId,
  { min: number; max: number }
> = {
  chest: { min: 10, max: 20 },
  back: { min: 10, max: 20 },
  legs: { min: 10, max: 20 },
  shoulders: { min: 8, max: 16 },
  arms: { min: 6, max: 14 },
  core: { min: 4, max: 12 },
  glutes: { min: 8, max: 16 },
  hamstrings: { min: 6, max: 14 },
  quads: { min: 8, max: 16 },
  calves: { min: 6, max: 14 },
  other: { min: 0, max: 20 },
}

export function classifyMuscleGroup(exerciseName: string): MuscleGroupId {
  for (const rule of RULES) {
    if (rule.pattern.test(exerciseName)) return rule.id
  }
  return "other"
}
