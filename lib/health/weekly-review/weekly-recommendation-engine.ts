/**
 * WeeklyRecommendationEngine — up to five priorities for next week.
 */

import type { WeeklyFocusItem, WeeklyReviewView } from "./types"

export function buildWeeklyFocus(
  view: Pick<
    WeeklyReviewView,
    | "training"
    | "nutrition"
    | "recovery"
    | "blood"
    | "treatments"
    | "negativeChanges"
    | "wins"
  >
): WeeklyFocusItem[] {
  const focus: WeeklyFocusItem[] = []

  if (
    view.training.narrative.some((line) => /lower body/i.test(line)) ||
    view.training.strengthSessions < 3
  ) {
    focus.push({
      id: "lower-volume",
      body:
        view.training.strengthSessions < 3
          ? "Protect three strength sessions next week."
          : "Increase lower body volume.",
      why:
        view.training.strengthSessions < 3
          ? `Only ${view.training.strengthSessions} strength sessions landed this week.`
          : "Lower-body volume has been called out as below target in recent training signals.",
      confidence: "Medium",
    })
  }

  if (view.nutrition.avgProtein != null) {
    const target = Math.max(200, view.nutrition.avgProtein)
    if (view.nutrition.proteinDaysHit < 6) {
      focus.push({
        id: "protein",
        body: `Maintain protein above ${Math.round(target)} g.`,
        why: `Protein target was hit on ${view.nutrition.proteinDaysHit} of ${view.nutrition.daysLogged || 7} days.`,
        confidence: "High",
      })
    }
  }

  const stepWin = view.wins.find((win) => win.id === "steps")
  if (stepWin) {
    focus.push({
      id: "steps",
      body: "Aim for 90,000 weekly steps.",
      why: "Step volume was a clear win — stretching it slightly compounds fat-loss and recovery.",
      confidence: "Medium",
    })
  } else {
    focus.push({
      id: "steps-build",
      body: "Rebuild daily walking consistency.",
      why: "Step volume did not stand out this week relative to your stronger weeks.",
      confidence: "Low",
    })
  }

  if (!view.blood.hasNewTests) {
    focus.push({
      id: "blood",
      body: "Keep the next blood panel on the calendar.",
      why: "No new blood tests this week — longitudinal markers need scheduled sampling.",
      confidence: "Low",
    })
  }

  if (
    view.recovery.recoveryAvg != null &&
    view.recovery.recoveryAvg < 60
  ) {
    focus.push({
      id: "sleep",
      body: "Prioritise an earlier wind-down on training days.",
      why: `Recovery averaged ${view.recovery.recoveryAvg}% with sleep as a likely contributor.`,
      confidence: "Medium",
    })
  }

  if (
    view.treatments.adherencePct != null &&
    view.treatments.adherencePct < 90
  ) {
    focus.push({
      id: "treatment",
      body: "Tighten treatment timing for scheduled doses.",
      why: `Treatment adherence was ${view.treatments.adherencePct}% this week.`,
      confidence: "High",
    })
  }

  for (const change of view.negativeChanges.slice(0, 2)) {
    if (focus.length >= 5) break
    if (change.id === "sleep" && focus.some((item) => item.id === "sleep")) continue
    focus.push({
      id: `fix-${change.id}`,
      body: `Address ${change.label.toLowerCase()} early next week.`,
      why: `${change.label} moved ${change.value} versus the prior week.`,
      confidence: "Medium",
    })
  }

  return focus.slice(0, 5)
}

export const WeeklyRecommendationEngine = {
  build: buildWeeklyFocus,
} as const
