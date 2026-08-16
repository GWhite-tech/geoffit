/**
 * Human-facing labels for Coach Phase 1 permission categories.
 * Vocabulary must stay aligned with COACH_PERMISSION_CATEGORIES.
 */

import {
  COACH_PERMISSION_CATEGORIES,
  type CoachPermissionCategory,
} from "./categories"

export type CoachPermissionCopy = {
  category: CoachPermissionCategory
  label: string
  description: string
}

export const COACH_PERMISSION_COPY: Record<
  CoachPermissionCategory,
  CoachPermissionCopy
> = {
  vitals: {
    category: "vitals",
    label: "Vitals",
    description:
      "Allows your Coach to view heart rate, HRV, steps, VO₂ max, and blood pressure metrics.",
  },
  sleep: {
    category: "sleep",
    label: "Sleep",
    description: "Allows your Coach to view your sleep analysis data.",
  },
  body: {
    category: "body",
    label: "Body composition",
    description:
      "Allows your Coach to view weight, body fat, lean mass, BMI, waist, and height.",
  },
  nutrition: {
    category: "nutrition",
    label: "Nutrition",
    description:
      "Allows your Coach to view nutrition days and dietary intake metrics.",
  },
  training: {
    category: "training",
    label: "Training",
    description:
      "Allows your Coach to view your training and workout data.",
  },
  blood: {
    category: "blood",
    label: "Blood",
    description: "Allows your Coach to view your blood-test panels and markers.",
  },
  treatments: {
    category: "treatments",
    label: "Treatments",
    description:
      "Allows your Coach to view treatments, lots, and dose events.",
  },
}

export function coachPermissionCopy(
  category: CoachPermissionCategory
): CoachPermissionCopy {
  return COACH_PERMISSION_COPY[category]
}

export function allCoachPermissionCopy(): CoachPermissionCopy[] {
  return COACH_PERMISSION_CATEGORIES.map((c) => COACH_PERMISSION_COPY[c])
}
