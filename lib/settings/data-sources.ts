import type { BloodTest } from "@/lib/domain/blood"
import type { HealthRecord } from "@/lib/domain/health"
import type { HevyWorkoutEntry } from "@/lib/health/workout"

import type { DataSourceStatus } from "./types"

function formatWhen(iso: string | null): string | null {
  if (!iso) return null
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return iso.slice(0, 10)
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time))
}

function latestIso(values: Array<string | undefined>): string | null {
  const sorted = values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))
  return sorted[0] ?? null
}

/**
 * Derive connected / manual data source status from live stores.
 */
export function buildDataSourceStatuses(input: {
  healthRecords: HealthRecord[]
  bloodTests: BloodTest[]
  hevyWorkouts?: HevyWorkoutEntry[]
}): DataSourceStatus[] {
  const appleDates = input.healthRecords
    .filter((record) => record.source === "apple_health")
    .map((record) => record.endDate || record.startDate)
  const appleLatest = latestIso(appleDates)

  const hevyWorkouts = input.hevyWorkouts ?? []
  const hevyLatest = latestIso(hevyWorkouts.map((workout) => workout.endDate))

  const pdfTests = input.bloodTests.filter((test) =>
    /\.pdf$/i.test(test.sourceFileName) || /pdf|numan|nhs/i.test(test.source)
  )
  const numan = input.bloodTests.filter((test) =>
    /numan/i.test(test.provider + test.source + test.sourceFileName)
  )
  const nhs = input.bloodTests.filter((test) =>
    /nhs/i.test(test.provider + test.source + test.sourceFileName)
  )
  const screenshot = input.bloodTests.filter((test) =>
    /screenshot|image|png|jpg|jpeg|ocr/i.test(
      test.source + test.sourceFileName
    )
  )
  const csv = input.bloodTests.filter((test) =>
    /\.csv$/i.test(test.sourceFileName) || /csv/i.test(test.source)
  )

  const connected: DataSourceStatus[] = [
    {
      id: "apple_health",
      name: "Apple Health",
      status: input.healthRecords.length > 0 ? "connected" : "available",
      detail:
        input.healthRecords.length > 0
          ? `${input.healthRecords.length.toLocaleString("en-GB")} records`
          : "Not imported yet",
      lastActivity: appleLatest,
      lastActivityLabel: appleLatest
        ? `Last sync · ${formatWhen(appleLatest)}`
        : null,
      actions:
        input.healthRecords.length > 0
          ? ["reimport", "sync", "history"]
          : ["connect"],
    },
    {
      id: "hevy",
      name: "Hevy",
      status: hevyWorkouts.length > 0 ? "connected" : "available",
      detail:
        hevyWorkouts.length > 0
          ? `${hevyWorkouts.length.toLocaleString("en-GB")} workouts`
          : "Import workout CSV export",
      lastActivity: hevyLatest,
      lastActivityLabel: hevyLatest
        ? `Last import · ${formatWhen(hevyLatest)}`
        : null,
      actions:
        hevyWorkouts.length > 0
          ? ["reimport", "history"]
          : ["connect"],
    },
    {
      id: "numan",
      name: "Numan",
      status: numan.length > 0 ? "manual" : "available",
      detail:
        numan.length > 0
          ? `${numan.length} PDF import${numan.length === 1 ? "" : "s"}`
          : "Manual PDF import",
      lastActivity: latestIso(numan.map((test) => test.testDate)),
      lastActivityLabel: latestIso(numan.map((test) => test.testDate))
        ? `Last import · ${formatWhen(latestIso(numan.map((test) => test.testDate))!)}`
        : null,
      actions: numan.length > 0 ? ["reimport", "history"] : ["connect"],
    },
    {
      id: "nhs",
      name: "NHS",
      status: nhs.length > 0 || screenshot.length > 0 ? "manual" : "available",
      detail:
        screenshot.length > 0
          ? "Screenshot import"
          : nhs.length > 0
            ? "Manual import"
            : "Screenshot or PDF import",
      lastActivity: latestIso(
        [...nhs, ...screenshot].map((test) => test.testDate)
      ),
      lastActivityLabel: (() => {
        const when = latestIso(
          [...nhs, ...screenshot].map((test) => test.testDate)
        )
        return when ? `Last import · ${formatWhen(when)}` : null
      })(),
      actions:
        nhs.length > 0 || screenshot.length > 0
          ? ["reimport", "history"]
          : ["connect"],
    },
    {
      id: "csv",
      name: "CSV Imports",
      status: csv.length > 0 ? "manual" : "available",
      detail: "Manual",
      lastActivity: latestIso(csv.map((test) => test.testDate)),
      lastActivityLabel: (() => {
        const when = latestIso(csv.map((test) => test.testDate))
        return when ? `Last import · ${formatWhen(when)}` : null
      })(),
      actions: csv.length > 0 ? ["reimport", "history"] : ["connect"],
    },
    {
      id: "pdf_generic",
      name: "Blood PDFs",
      status: pdfTests.length > 0 ? "manual" : "available",
      detail:
        pdfTests.length > 0
          ? `${pdfTests.length} imported`
          : "Manual PDF import",
      lastActivity: latestIso(pdfTests.map((test) => test.testDate)),
      lastActivityLabel: (() => {
        const when = latestIso(pdfTests.map((test) => test.testDate))
        return when ? `Last import · ${formatWhen(when)}` : null
      })(),
      actions: pdfTests.length > 0 ? ["reimport", "history"] : ["connect"],
    },
  ]

  const future = [
    "Strong",
    "Garmin",
    "Polar",
    "Whoop",
    "Oura",
    "Fitbit",
    "Dexcom",
    "Wahoo",
    "MyFitnessPal",
    "Cronometer",
    "MacroFactor",
  ].map((name) => ({
    id: name.toLowerCase(),
    name,
    status: "coming_soon" as const,
    detail:
      name === "Strong"
        ? "Future strength connector"
        : "Future connector",
    lastActivity: null,
    lastActivityLabel: null,
    actions: [] as DataSourceStatus["actions"],
  }))

  return [...connected, ...future]
}
