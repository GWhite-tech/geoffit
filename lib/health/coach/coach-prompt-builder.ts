import type {
  CoachHealthContext,
  CoachMemorySnapshot,
  CoachPromptBundle,
} from "./types"

const SYSTEM_STYLE = `You are Geoffit's AI Coach — an experienced performance and longevity coach.
You already know the user's complete health history from Geoffit stores.
Speak calmly, directly, and professionally. Never say "As an AI".
Never invent measurements or trends. If data is missing, say so.
Always explain WHY when interpreting change. Ground every fact in the context below.`

/**
 * CoachPromptBuilder — structured bundle for the response engine (and future LLMs).
 */
export function buildCoachPromptBundle(input: {
  context: CoachHealthContext
  memory: CoachMemorySnapshot
  userQuestion: string
  conversationSummary?: string
}): CoachPromptBundle {
  const { context, memory, userQuestion } = input
  const lines: string[] = ["# Geoffit Health Context", ""]

  const push = (label: string, value: string | null | undefined) => {
    if (value) lines.push(`- ${label}: ${value}`)
    else lines.push(`- ${label}: unavailable`)
  }

  push("Weight", context.currentWeight?.display)
  push(
    "Health score",
    context.healthScore?.score != null
      ? `${context.healthScore.score} (${context.healthScore.confidence})`
      : null
  )
  push(
    "Recovery",
    context.recovery?.score != null
      ? `${context.recovery.score}% (${context.recovery.label})`
      : null
  )
  push("Protocol", context.currentProtocol)
  push(
    "Medications",
    context.medications.length
      ? context.medications.map((m) => `${m.name} ${m.dose}`).join("; ")
      : null
  )
  push("Protein avg (30d)", context.proteinAverage?.display)
  push("Calories avg (30d)", context.caloriesAverage?.display)
  push("Sleep avg (30d)", context.sleepAverage?.display)
  push(
    "Latest blood test",
    context.latestBloodTest
      ? `${context.latestBloodTest.date} · ${context.latestBloodTest.panel}`
      : null
  )
  push(
    "Last workout",
    context.lastWorkout
      ? `${context.lastWorkout.date} · ${context.lastWorkout.label} · ${context.lastWorkout.sourcesLabel}`
      : null
  )
  push(
    "12w weight delta",
    context.weightTrend12w.deltaLb != null
      ? `${context.weightTrend12w.deltaLb.toFixed(1)} lb`
      : null
  )
  push("HbA1c", context.hba1c.latest)
  push("Testosterone", context.testosterone.latest)
  push("Body fat", context.bodyFat.latestDisplay)

  if (context.interventions.length) {
    lines.push("", "## Interventions")
    for (const item of context.interventions) {
      lines.push(`- ${item.date}: ${item.label}`)
    }
  }

  if (memory.facts.length) {
    lines.push("", "## Memory facts")
    for (const fact of memory.facts) lines.push(`- ${fact}`)
  }

  if (context.unavailable.length) {
    lines.push("", "## Unavailable")
    for (const item of context.unavailable) lines.push(`- ${item}`)
  }

  return {
    systemStyle: SYSTEM_STYLE,
    contextMarkdown: lines.join("\n"),
    memoryFacts: memory.facts,
    userQuestion,
    conversationSummary: input.conversationSummary ?? "",
  }
}
