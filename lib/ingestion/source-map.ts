/**
 * Maps UI data-source ids → document kinds for the ingestion spine.
 */

import type { DataSourceId } from "@/lib/importers/sources"

import type { DocumentKind } from "./types"

const SOURCE_TO_KIND: Partial<Record<DataSourceId, DocumentKind>> = {
  "blood-test": "blood_lab_pdf",
  "blood-screenshots": "blood_screenshots",
  "apple-health": "apple_health_export",
  hevy: "hevy_csv",
  csv: "generic_csv",
  "progress-photos": "progress_photo",
}

export function documentKindForSource(
  sourceId: DataSourceId
): DocumentKind | null {
  return SOURCE_TO_KIND[sourceId] ?? null
}

export function sourceUsesIngestionSpine(sourceId: DataSourceId): boolean {
  const kind = documentKindForSource(sourceId)
  return kind != null && kind !== "blood_screenshots"
  // screenshots: multi-file; Storage batch path lands next — still registered
}
