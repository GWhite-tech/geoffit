import type { CoachCitation, CoachHealthContext } from "./types"

/**
 * CoachCitationEngine — every factual claim should be traceable to Geoffit data.
 */
export function buildCitationsForContext(
  context: CoachHealthContext,
  keys: Array<
    | "weight"
    | "health_score"
    | "recovery"
    | "nutrition"
    | "sleep"
    | "blood"
    | "hba1c"
    | "testosterone"
    | "treatments"
    | "progress"
    | "workout"
  >
): CoachCitation[] {
  const citations: CoachCitation[] = []

  for (const key of keys) {
    switch (key) {
      case "weight":
        if (context.currentWeight) {
          citations.push({
            id: "cite-weight",
            label: "Weight",
            source: "health",
            detail: context.currentWeight.display,
            href: "/progress",
          })
        }
        break
      case "health_score":
        if (context.healthScore?.score != null) {
          citations.push({
            id: "cite-score",
            label: "Health Score",
            source: "progress",
            detail: String(context.healthScore.score),
            href: "/progress",
          })
        }
        break
      case "recovery":
        if (context.recovery?.score != null) {
          citations.push({
            id: "cite-recovery",
            label: "Recovery",
            source: "health",
            detail: `${context.recovery.score}%`,
            href: "/progress",
          })
        }
        break
      case "nutrition":
        if (context.proteinAverage || context.caloriesAverage) {
          citations.push({
            id: "cite-nutrition",
            label: "Nutrition",
            source: "nutrition",
            detail: [
              context.proteinAverage?.display,
              context.caloriesAverage?.display,
            ]
              .filter(Boolean)
              .join(" · "),
            href: "/nutrition",
          })
        }
        break
      case "sleep":
        if (context.sleepAverage) {
          citations.push({
            id: "cite-sleep",
            label: "Sleep",
            source: "sleep",
            detail: context.sleepAverage.display,
            href: "/sleep",
          })
        }
        break
      case "blood":
        if (context.latestBloodTest) {
          citations.push({
            id: "cite-blood",
            label: "Latest blood test",
            source: "blood",
            detail: `${context.latestBloodTest.panel} · ${context.latestBloodTest.date}`,
            href: "/blood",
          })
        }
        break
      case "hba1c":
        if (context.hba1c.latest) {
          citations.push({
            id: "cite-hba1c",
            label: "HbA1c",
            source: "blood",
            detail: context.hba1c.latest,
            href: "/blood/hba1c",
          })
        }
        break
      case "testosterone":
        if (context.testosterone.latest) {
          citations.push({
            id: "cite-testosterone",
            label: "Testosterone",
            source: "blood",
            detail: context.testosterone.latest,
            href: context.testosterone.href,
          })
        }
        break
      case "treatments":
        if (context.medications.length > 0) {
          citations.push({
            id: "cite-treatments",
            label: "Treatments",
            source: "treatment",
            detail: context.currentProtocol,
            href: "/treatment",
          })
        }
        break
      case "progress":
        citations.push({
          id: "cite-progress",
          label: "Progress analytics",
          source: "progress",
          detail: "Longitudinal trends & story",
          href: "/progress",
        })
        break
      case "workout":
        if (context.lastWorkout) {
          citations.push({
            id: "cite-workout",
            label: "Last workout",
            source: "health",
            detail: `${context.lastWorkout.label} · ${context.lastWorkout.date}`,
            href: null,
          })
        }
        break
    }
  }

  return citations
}
