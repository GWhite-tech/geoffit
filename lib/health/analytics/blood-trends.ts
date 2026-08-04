import type { BloodTest } from "@/lib/domain/blood"

import type { BloodMarkerTrendCard } from "./types"
import { formatShortDate, formatShortDateWithYear } from "./series"
import {
  formatBiomarkerDelta,
  formatBiomarkerValue,
  getBiomarkerDefinition,
  missionControlBiomarkers,
} from "@/lib/health/biomarker-registry"

/**
 * Build blood marker trend cards from Blood Store tests.
 * Primary status uses Geoffit clinical interpretation when configured.
 * Laboratory reference comes from the imported result when available.
 */
export function buildBloodMarkerCards(
  tests: BloodTest[]
): BloodMarkerTrendCard[] {
  const sorted = [...tests].sort((a, b) => a.testDate.localeCompare(b.testDate))
  const tracked = missionControlBiomarkers()

  return tracked.map((marker) => {
    const keys = new Set([marker.id, ...marker.aliases])
    const series: Array<{
      date: string
      value: number
      unit: string
      referenceRange: BloodTest["markers"][number]["referenceRange"]
    }> = []

    for (const test of sorted) {
      const found = test.markers.find((entry) => keys.has(entry.key))
      if (!found) continue
      series.push({
        date: test.testDate,
        value: found.value,
        unit: found.unit || marker.unit,
        referenceRange: found.referenceRange,
      })
    }

    if (series.length === 0) {
      return {
        id: marker.id,
        key: marker.id,
        label: marker.shortName,
        available: false,
        latestDisplay: null,
        latestDateLabel: null,
        changeDisplay: null,
        changeDirection: "neutral" as const,
        statusLabel: null,
        statusColorClass: null,
        statusTone: "unknown" as const,
        labReferenceDisplay: null,
        laboratoryStatusLabel: null,
        sparkline: [],
        emptyHint: `Import a blood test that includes ${marker.displayName}.`,
        href: `/blood/${marker.id}`,
      }
    }

    const latest = series[series.length - 1]!
    const previous = series.length >= 2 ? series[series.length - 2] : null
    const unit = latest.unit || marker.unit
    const dual = marker.interpretDual(latest.value, latest.referenceRange)
    const status = dual.clinical

    let changeDisplay: string | null = null
    let changeDirection: BloodMarkerTrendCard["changeDirection"] = "neutral"
    if (previous) {
      const delta = latest.value - previous.value
      const formatted = formatBiomarkerDelta(delta, unit)
      changeDisplay = formatted.display
      changeDirection = formatted.direction
    }

    return {
      id: marker.id,
      key: marker.id,
      label: marker.shortName,
      available: true,
      latestDisplay: formatBiomarkerValue(marker.id, latest.value),
      latestDateLabel:
        latest.date !== "unknown"
          ? formatShortDateWithYear(latest.date)
          : null,
      changeDisplay,
      changeDirection,
      statusLabel: status.label,
      statusColorClass: status.colorClass,
      statusTone:
        status.colour === "green"
          ? ("normal" as const)
          : status.colour === "red"
            ? ("attention" as const)
            : status.colour === "amber"
              ? ("high" as const)
              : ("unknown" as const),
      labReferenceDisplay: dual.laboratoryRangeDisplay,
      laboratoryStatusLabel: dual.laboratory.label,
      sparkline: series.map((point) => point.value),
      emptyHint: null,
      href: `/blood/${marker.id}`,
    }
  })
}

export function bloodTestTimelineEvents(tests: BloodTest[]) {
  return [...tests]
    .sort((a, b) => b.testDate.localeCompare(a.testDate))
    .map((test) => {
      const markerNames = test.markers
        .map((m) => getBiomarkerDefinition(m.key)?.shortName ?? m.name)
        .slice(0, 4)
      const extra =
        test.markers.length > 4 ? ` +${test.markers.length - 4}` : ""

      return {
        id: `blood-${test.id}`,
        kind: "blood_test" as const,
        dateLabel: formatShortDate(test.testDate),
        time: "",
        title: "Blood test imported",
        detail:
          markerNames.length > 0
            ? `${test.markers.length} markers updated · ${markerNames.join(", ")}${extra}`
            : `${test.provider} · ${test.markers.length} markers`,
        sortKey: `${test.testDate}T12:00:00.000Z`,
      }
    })
}
