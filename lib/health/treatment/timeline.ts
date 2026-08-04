import type { DoseEvent, Treatment } from "@/lib/domain/treatment"
import { DOSE_EVENT_LABELS } from "@/lib/domain/treatment"
import { formatShortDate } from "@/lib/health/analytics/series"
import type { McTimelineEvent } from "@/lib/health/analytics/types"

export function treatmentTimelineEvents(
  treatments: Treatment[],
  events: DoseEvent[]
): McTimelineEvent[] {
  const byId = new Map(treatments.map((treatment) => [treatment.id, treatment]))

  return [...events]
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .slice(0, 40)
    .map((event) => {
      const treatment = byId.get(event.treatmentId)
      const name = treatment?.shortName ?? "Treatment"
      return {
        id: `tx-${event.id}`,
        kind: "medication" as const,
        dateLabel: formatShortDate(event.date),
        time: event.scheduledTime ?? "",
        title: `${DOSE_EVENT_LABELS[event.kind]} · ${name}`,
        detail:
          event.dose != null
            ? `${event.dose}${event.doseUnit ? ` ${event.doseUnit}` : ""}`
            : event.notes,
        sortKey: event.recordedAt,
      }
    })
}

export function treatmentAlertCards(
  treatments: Treatment[],
  reminders: Array<{ id: string; title: string; detail: string; kind: string }>
) {
  return reminders.slice(0, 4).map((reminder) => ({
    id: reminder.id,
    title: reminder.title,
    detail: reminder.detail,
    kind: reminder.kind,
    href: reminder.id.includes("-")
      ? `/treatment/${treatments.find((t) => reminder.title.includes(t.shortName))?.id ?? ""}`
      : "/treatment",
  }))
}
