import type { ProjectionEstimate, WhatsNextItem } from "./types"

function confidenceLabel(
  confidence: ProjectionEstimate["confidence"]
): WhatsNextItem["confidence"] {
  switch (confidence) {
    case "high":
      return "High"
    case "moderate":
      return "Medium"
    case "low":
      return "Low"
  }
}

/**
 * Narrative "What's Next?" items from projection estimates.
 * Soft language only — never implies certainty.
 */
export function buildWhatsNext(
  projections: ProjectionEstimate[]
): WhatsNextItem[] {
  const items: WhatsNextItem[] = []

  for (const projection of projections) {
    if (projection.id === "goal_weight") {
      items.push({
        id: projection.id,
        headline: "Goal weight",
        estimatedDisplay: projection.available
          ? projection.estimatedDateDisplay
          : null,
        confidence: confidenceLabel(projection.confidence),
        note: projection.available
          ? projection.note
          : "Need a clearer weight trend before estimating.",
        available: projection.available && projection.estimatedDateDisplay != null,
      })
      continue
    }

    if (projection.id === "goal_hba1c") {
      items.push({
        id: projection.id,
        headline: "HbA1c projected into normal range",
        estimatedDisplay: projection.available
          ? projection.estimatedDateDisplay
          : null,
        confidence: confidenceLabel(projection.confidence),
        note: projection.note,
        available:
          projection.available && projection.estimatedDateDisplay != null,
      })
      continue
    }

    if (projection.id === "goal_body_fat") {
      items.push({
        id: projection.id,
        headline: "Body fat toward target",
        estimatedDisplay: projection.available
          ? projection.estimatedDateDisplay
          : null,
        confidence: confidenceLabel(projection.confidence),
        note: projection.note,
        available:
          projection.available && projection.estimatedDateDisplay != null,
      })
      continue
    }

    if (projection.id === "visceral_fat") {
      items.push({
        id: projection.id,
        headline: "Visceral fat likely to reduce below target",
        estimatedDisplay: null,
        confidence: "Low",
        note: "Visceral fat is not in current imports — no estimate possible.",
        available: false,
      })
      continue
    }

    if (projection.id === "testosterone_trend" && projection.available) {
      items.push({
        id: projection.id,
        headline: "Projected testosterone trend",
        estimatedDisplay: projection.targetDisplay,
        confidence: confidenceLabel(projection.confidence),
        note: projection.note,
        available: true,
      })
    }
  }

  // Prefer items we can date; keep unavailable visceral as honesty signal at end
  return [
    ...items.filter((item) => item.available),
    ...items.filter((item) => !item.available),
  ].slice(0, 5)
}
