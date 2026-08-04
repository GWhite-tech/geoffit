import { HEALTH_METRIC_LABELS, type HealthRecord } from "@/lib/domain/health"

import type { AppleHealthAnalysis } from "./types"

export function analyzeHealthRecords(records: HealthRecord[]): AppleHealthAnalysis {
  const countsByType: Record<string, number> = {}
  const fingerprintCounts = new Map<string, number>()
  let minTime = Number.POSITIVE_INFINITY
  let maxTime = Number.NEGATIVE_INFINITY

  for (const record of records) {
    countsByType[record.type] = (countsByType[record.type] ?? 0) + 1
    fingerprintCounts.set(
      record.fingerprint,
      (fingerprintCounts.get(record.fingerprint) ?? 0) + 1
    )

    const start = Date.parse(record.startDate)
    const end = Date.parse(record.endDate)
    if (!Number.isNaN(start)) minTime = Math.min(minTime, start)
    if (!Number.isNaN(end)) maxTime = Math.max(maxTime, end)
  }

  let duplicateCount = 0
  let duplicateGroups = 0

  for (const count of fingerprintCounts.values()) {
    if (count > 1) {
      duplicateGroups += 1
      duplicateCount += count - 1
    }
  }

  return {
    dateRange:
      Number.isFinite(minTime) && Number.isFinite(maxTime)
        ? {
            start: new Date(minTime).toISOString().split("T")[0],
            end: new Date(maxTime).toISOString().split("T")[0],
          }
        : null,
    duplicateCount,
    duplicateGroups,
    countsByType,
  }
}

export function formatTypeCounts(countsByType: Record<string, number>): string {
  return Object.entries(countsByType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => {
      const label =
        HEALTH_METRIC_LABELS[type as keyof typeof HEALTH_METRIC_LABELS] ?? type
      return `${label}: ${count.toLocaleString()}`
    })
    .join(" · ")
}
