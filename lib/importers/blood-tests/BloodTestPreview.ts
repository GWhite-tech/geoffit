import { BLOOD_MARKER_STATUS_LABELS, type BloodTest } from "@/lib/domain/blood"
import type { ImportPreview } from "../ImportResult"

function formatMarkerValue(value: number): string {
  if (Number.isInteger(value)) return String(value)
  const fixed = value.toFixed(3).replace(/\.?0+$/, "")
  return fixed
}

export function buildBloodTestPreview(
  test: BloodTest,
  importerId: string,
  extraWarnings: string[] = []
): ImportPreview {
  const statusCounts = test.markers.reduce(
    (acc, marker) => {
      acc[marker.status] = (acc[marker.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const outOfRange = test.markers.filter(
    (m) => m.status === "high" || m.status === "low" || m.status === "critical"
  ).length

  const categories = [
    test.provider,
    `${test.markers.length} markers`,
    ...(outOfRange > 0 ? [`${outOfRange} out of range`] : []),
  ]

  return {
    importerId,
    fileName: test.sourceFileName,
    summary: `${test.panelName} · ${test.provider} · ${test.markers.length} biomarkers${
      test.testDate !== "unknown" ? ` · taken ${test.testDate}` : ""
    }.`,
    recordCount: test.markers.length,
    categories,
    dateRange:
      test.testDate !== "unknown"
        ? { start: test.testDate, end: test.testDate }
        : undefined,
    countsByType: statusCounts,
    rows: test.markers.map((marker) => ({
      id: marker.id,
      category: BLOOD_MARKER_STATUS_LABELS[marker.status],
      label: marker.name,
      value: [
        formatMarkerValue(marker.value),
        marker.unit,
        marker.referenceRange.text !== "—"
          ? `(ref ${marker.referenceRange.text})`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
      date: test.testDate !== "unknown" ? test.testDate : undefined,
      status: marker.status,
    })),
    warnings: [
      "Review extracted biomarkers carefully before confirming import.",
      ...extraWarnings,
    ],
  }
}
