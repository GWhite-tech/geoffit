import type { CoachHealthContext, CoachMemorySnapshot } from "./types"

/**
 * CoachMemory — durable working memory distilled from context.
 * Future: persist across sessions / voice / weekly reports.
 */
export function buildCoachMemory(
  context: CoachHealthContext
): CoachMemorySnapshot {
  const facts: string[] = []
  const focusAreas: string[] = []
  const openQuestions: string[] = []

  if (context.currentWeight) {
    facts.push(`Current weight ${context.currentWeight.display}.`)
  }
  if (context.weightTrend12w.deltaLb != null) {
    const d = context.weightTrend12w.deltaLb
    facts.push(
      d < 0
        ? `Lost ${Math.abs(d).toFixed(1)} lb over ~12 weeks.`
        : d > 0
          ? `Gained ${d.toFixed(1)} lb over ~12 weeks.`
          : `Weight essentially unchanged over ~12 weeks.`
    )
  }
  if (context.healthScore?.score != null) {
    facts.push(
      `Health score ${context.healthScore.score} (${context.healthScore.confidence} confidence).`
    )
  }
  if (context.recovery?.score != null) {
    facts.push(`Recovery ${context.recovery.score}% (${context.recovery.label}).`)
  }
  if (context.proteinAverage) {
    facts.push(
      `Protein averaging ${context.proteinAverage.display} over ${context.proteinAverage.days} days.`
    )
  }
  if (context.caloriesAverage) {
    facts.push(
      `Calories averaging ${context.caloriesAverage.display} over ${context.caloriesAverage.days} days.`
    )
  }
  if (context.sleepAverage) {
    facts.push(
      `Sleep averaging ${context.sleepAverage.display} across ${context.sleepAverage.nights} nights.`
    )
  }
  if (context.hba1c.latest) {
    facts.push(
      context.hba1c.previous
        ? `HbA1c ${context.hba1c.previous} → ${context.hba1c.latest}.`
        : `Latest HbA1c ${context.hba1c.latest}.`
    )
  }
  if (context.testosterone.latest) {
    facts.push(
      `Testosterone ${context.testosterone.latest}${
        context.testosterone.status ? ` (${context.testosterone.status})` : ""
      }.`
    )
  }
  if (context.medications.length > 0) {
    facts.push(
      `Active medications: ${context.medications
        .map((m) => `${m.name} ${m.dose}`)
        .join("; ")}.`
    )
  }
  if (context.leanMassTrend.stable === true) {
    facts.push("Lean mass has remained stable during recent weight change.")
  }

  if (context.recovery?.score != null && context.recovery.score < 70) {
    focusAreas.push("Recovery")
  }
  if (
    context.proteinAverage &&
    context.nutritionTargets &&
    context.proteinAverage.value < context.nutritionTargets.protein * 0.9
  ) {
    focusAreas.push("Protein adherence")
  }
  if (context.sleepAverage && context.sleepAverage.minutes < 7 * 60) {
    focusAreas.push("Sleep duration")
  }
  if (context.weightTrend12w.deltaLb != null && context.weightTrend12w.deltaLb > -2) {
    focusAreas.push("Weight-loss momentum")
  }

  for (const missing of context.unavailable.slice(0, 4)) {
    openQuestions.push(`${missing} is not available in current imports.`)
  }

  return {
    updatedAt: context.generatedAt,
    facts,
    openQuestions,
    focusAreas,
  }
}
