import type { CoachAction, CoachHealthContext, CoachTopic } from "./types"

/**
 * CoachActionEngine — clickable next steps grounded in current gaps/opportunities.
 */
export function buildCoachActions(
  context: CoachHealthContext,
  topic: CoachTopic
): CoachAction[] {
  const actions: CoachAction[] = []

  if (
    context.proteinAverage &&
    context.nutritionTargets &&
    context.proteinAverage.value < context.nutritionTargets.protein * 0.95
  ) {
    actions.push({
      id: "action-protein",
      label: "Increase protein target",
      kind: "adjust_target",
      href: "/nutrition",
      payload: { field: "protein" },
    })
  }

  if (
    context.caloriesAverage &&
    context.nutritionTargets &&
    context.caloriesAverage.value > context.nutritionTargets.calories * 1.05
  ) {
    actions.push({
      id: "action-calories",
      label: "Change calorie target",
      kind: "adjust_target",
      href: "/nutrition",
      payload: { field: "calories" },
    })
  }

  if (context.latestBloodTest) {
    actions.push({
      id: "action-blood",
      label: "Review blood tests",
      kind: "review_labs",
      href: "/blood",
    })
  }

  if (context.hba1c.latest) {
    actions.push({
      id: "action-hba1c",
      label: "Schedule another HbA1c",
      kind: "schedule",
      href: "/blood/hba1c",
    })
  }

  if (context.medications.length > 0) {
    actions.push({
      id: "action-treatment",
      label: "Adjust treatment schedule",
      kind: "protocol",
      href: "/treatment",
    })
  }

  actions.push({
    id: "action-progress",
    label: "Open Progress",
    kind: "open_page",
    href: "/progress",
  })

  if (topic === "blood" || topic === "medication") {
    actions.push({
      id: "action-blood-markers",
      label: "Open Blood Markers",
      kind: "open_page",
      href: "/blood",
    })
  }

  if (topic === "sleep" || topic === "recovery") {
    actions.push({
      id: "action-sleep",
      label: "Open Sleep",
      kind: "open_page",
      href: "/sleep",
    })
  }

  if (context.medications.length === 0 && topic === "protocols") {
    actions.push({
      id: "action-start-protocol",
      label: "Start a new protocol",
      kind: "protocol",
      href: "/treatment",
    })
  }

  // Deduplicate by id, keep first 5
  const seen = new Set<string>()
  return actions.filter((action) => {
    if (seen.has(action.id)) return false
    seen.add(action.id)
    return true
  }).slice(0, 5)
}
