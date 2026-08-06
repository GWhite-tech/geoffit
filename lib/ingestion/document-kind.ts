/**
 * Shared document-kind identifiers for Storage uploads + ingestion parsers.
 * Keep in sync with DocumentParser registrations.
 */

export type DocumentKind =
  | "blood_lab_pdf"
  | "blood_screenshots"
  | "dexa_pdf"
  | "apple_health_export"
  | "hevy_csv"
  | "generic_csv"
  | "progress_photo"
  | "ecg"
  | "medical_document"
