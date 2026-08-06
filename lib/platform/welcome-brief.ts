/**
 * Personalised Mission Control greeting — reads existing MC view fields only.
 * Does not modify analytics engines.
 */

export type WelcomeBriefInput = {
  name: string
  bodyFromAnalytics?: string
  hasData: boolean
  weightDeltaLabel?: string | null
  sleepDeltaLabel?: string | null
  priorityLabel?: string | null
  medicationLabel?: string | null
}

export type WelcomeBrief = {
  greeting: string
  name: string
  lines: string[]
}

function timeGreeting(now = new Date()): string {
  const hour = now.getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export function buildWelcomeBrief(input: WelcomeBriefInput): WelcomeBrief {
  const greeting = timeGreeting()
  const lines: string[] = []

  if (input.weightDeltaLabel) lines.push(input.weightDeltaLabel)
  if (input.sleepDeltaLabel) lines.push(input.sleepDeltaLabel)
  if (input.priorityLabel) lines.push(`Today's priority: ${input.priorityLabel}`)
  if (input.medicationLabel) lines.push(input.medicationLabel)

  if (!lines.length && input.bodyFromAnalytics) {
    lines.push(input.bodyFromAnalytics)
  }

  if (!lines.length) {
    lines.push(
      input.hasData
        ? "Your health operating system is ready when you are."
        : "Import Apple Health or add a measurement to unlock personalised insights."
    )
  }

  return {
    greeting,
    name: input.name,
    lines: lines.slice(0, 4),
  }
}
