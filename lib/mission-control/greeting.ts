/**
 * Presentation-only greeting for Mission Control.
 * Never falls back to "Good morning", "Morning Brief", or "Geoff".
 */

export type DailyBriefHeading = {
  /** Primary line shown as the brief title. */
  title: string
  /** Optional secondary line (e.g. date). */
  detail: string | null
  /** True when we have a real first name + time-based greeting. */
  personalized: boolean
}

function timeGreeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

/**
 * Build the Daily Brief heading from profile first name + local time.
 * Without a first name → "Today's Brief" (no demo names / greeting defaults).
 */
export function buildDailyBriefHeading(
  firstName: string | null | undefined,
  now: Date = new Date()
): DailyBriefHeading {
  const name = firstName?.trim() || null
  if (!name) {
    return {
      title: "Today's Brief",
      detail: null,
      personalized: false,
    }
  }

  return {
    title: `${timeGreeting(now)}, ${name}.`,
    detail: null,
    personalized: true,
  }
}
