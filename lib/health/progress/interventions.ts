import type { BloodTest } from "@/lib/domain/blood"
import type { DoseEvent, Treatment } from "@/lib/domain/treatment"

import { formatProgressDateLong } from "./range"
import type { InterventionMarker } from "./types"

/**
 * Build intervention markers from treatments, dose events, and blood tests.
 * These overlay charts so users can see what likely caused changes.
 */
export function buildInterventionMarkers(
  treatments: Treatment[],
  events: DoseEvent[],
  bloodTests: BloodTest[]
): InterventionMarker[] {
  const markers: InterventionMarker[] = []

  for (const treatment of treatments) {
    if (!treatment.startedAt) continue
    markers.push({
      id: `tx-start-${treatment.id}`,
      date: treatment.startedAt.slice(0, 10),
      label: `Started ${treatment.name}`,
      detail: treatment.category,
      kind: "medication_start",
    })
  }

  for (const event of events) {
    if (event.kind === "increased" || event.kind === "reduced") {
      const treatment = treatments.find((item) => item.id === event.treatmentId)
      markers.push({
        id: `tx-event-${event.id}`,
        date: event.date.slice(0, 10),
        label:
          event.kind === "increased"
            ? `${treatment?.name ?? "Treatment"} dose increased`
            : `${treatment?.name ?? "Treatment"} dose reduced`,
        detail:
          event.dose != null
            ? `${event.dose} ${event.doseUnit ?? treatment?.doseUnit ?? ""}`.trim()
            : event.notes ?? null,
        kind: "dose_change",
      })
    }
  }

  // Infer dose increases from rising taken doses when explicit events are absent.
  const byTreatment = new Map<string, DoseEvent[]>()
  for (const event of events) {
    if (event.kind !== "taken" || event.dose == null) continue
    const list = byTreatment.get(event.treatmentId) ?? []
    list.push(event)
    byTreatment.set(event.treatmentId, list)
  }

  for (const [treatmentId, list] of byTreatment) {
    const treatment = treatments.find((item) => item.id === treatmentId)
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
    let previous: number | null = null
    for (const event of sorted) {
      const dose = event.dose
      if (dose == null) continue
      if (previous != null && dose > previous * 1.05) {
        const id = `tx-dose-${event.id}`
        if (!markers.some((marker) => marker.id === id)) {
          markers.push({
            id,
            date: event.date.slice(0, 10),
            label: `${treatment?.name ?? "Treatment"} dose increased`,
            detail: `${previous} → ${dose} ${event.doseUnit ?? treatment?.doseUnit ?? ""}`.trim(),
            kind: "dose_change",
          })
        }
      }
      previous = dose
    }
  }

  for (const test of bloodTests) {
    const date = test.testDate.slice(0, 10)
    if (!date) continue
    markers.push({
      id: `blood-${test.id}`,
      date,
      label: "Blood test",
      detail: test.panelName || test.provider || null,
      kind: "blood_test",
    })
  }

  return markers
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((marker) => ({
      ...marker,
      detail: marker.detail ?? formatProgressDateLong(marker.date),
    }))
}
