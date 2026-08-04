/** Geoffit blood-test domain models — importers map here before persistence. */

export type BloodMarkerStatus =
  | "normal"
  | "high"
  | "low"
  | "critical"
  | "review"
  | "unknown"

export interface BloodReferenceRange {
  /** Inclusive lower bound when present. */
  low?: number
  /** Inclusive upper bound when present. */
  high?: number
  /** Original range text from the report (e.g. "35.0-50.0", "<40.0"). */
  text: string
}

export interface BloodMarker {
  id: string
  name: string
  /** Canonical slug for charts / comparisons (e.g. "hba1c", "testosterone"). */
  key: string
  value: number
  unit: string
  referenceRange: BloodReferenceRange
  status: BloodMarkerStatus
  /** Stable fingerprint for duplicate detection. */
  fingerprint: string
}

export interface BloodTest {
  id: string
  provider: string
  panelName: string
  /** ISO date of sample collection when known (YYYY-MM-DD). */
  testDate: string
  /** ISO datetime/date when results were exported. */
  exportedAt?: string
  patientName?: string
  sex?: string
  markers: BloodMarker[]
  clinicalReview?: string
  sourceFileName: string
  source: string
  fingerprint: string
}

export const BLOOD_MARKER_STATUS_LABELS: Record<BloodMarkerStatus, string> = {
  normal: "Normal",
  high: "High",
  low: "Low",
  critical: "Critical",
  review: "See clinical review",
  unknown: "Unknown",
}
