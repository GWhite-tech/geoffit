/**
 * Direct-to-Storage ingest uploads (browser → Supabase Storage).
 * Never proxy file bytes through Next.js / Vercel Functions.
 */

import type { DocumentKind } from "@/lib/ingestion/document-kind"

export type UserFilePurpose =
  | "avatar"
  | "raw_ingest"
  | "lab_pdf"
  | "progress_photo"
  | "report_pdf"
  | "journal"
  | "misc"

export type StorageBucketId =
  | "lab-pdfs"
  | "raw-ingest"
  | "progress-photos"
  | "report-pdfs"
  | "user-misc"
  | "avatars"

/** @deprecated Use DocumentKind from lib/ingestion/document-kind */
export type IngestDocumentKind = DocumentKind

export type IngestUploadSpec = {
  purpose: UserFilePurpose
  bucket: StorageBucketId
  documentKind: DocumentKind
  /** Soft client-side max; bucket enforces hard limit. */
  maxBytes: number
  acceptedMimeTypes: string[]
  acceptedExtensions: string[]
}

export const BLOOD_LAB_PDF_UPLOAD: IngestUploadSpec = {
  purpose: "lab_pdf",
  bucket: "lab-pdfs",
  documentKind: "blood_lab_pdf",
  maxBytes: 100 * 1024 * 1024,
  acceptedMimeTypes: ["application/pdf"],
  acceptedExtensions: [".pdf"],
}

export const APPLE_HEALTH_UPLOAD: IngestUploadSpec = {
  purpose: "raw_ingest",
  bucket: "raw-ingest",
  documentKind: "apple_health_export",
  maxBytes: 500 * 1024 * 1024,
  acceptedMimeTypes: [
    "application/zip",
    "application/x-zip-compressed",
    "application/xml",
    "text/xml",
    "application/octet-stream",
  ],
  acceptedExtensions: [".zip", ".xml"],
}

export const DEXA_PDF_UPLOAD: IngestUploadSpec = {
  purpose: "lab_pdf",
  bucket: "lab-pdfs",
  documentKind: "dexa_pdf",
  maxBytes: 100 * 1024 * 1024,
  acceptedMimeTypes: ["application/pdf"],
  acceptedExtensions: [".pdf"],
}

export const HEVY_CSV_UPLOAD: IngestUploadSpec = {
  purpose: "raw_ingest",
  bucket: "raw-ingest",
  documentKind: "hevy_csv",
  maxBytes: 50 * 1024 * 1024,
  acceptedMimeTypes: ["text/csv", "application/vnd.ms-excel", "text/plain"],
  acceptedExtensions: [".csv"],
}

export const GENERIC_CSV_UPLOAD: IngestUploadSpec = {
  purpose: "raw_ingest",
  bucket: "raw-ingest",
  documentKind: "generic_csv",
  maxBytes: 50 * 1024 * 1024,
  acceptedMimeTypes: ["text/csv", "application/vnd.ms-excel", "text/plain"],
  acceptedExtensions: [".csv"],
}

export const PROGRESS_PHOTO_UPLOAD: IngestUploadSpec = {
  purpose: "progress_photo",
  bucket: "progress-photos",
  documentKind: "progress_photo",
  maxBytes: 25 * 1024 * 1024,
  acceptedMimeTypes: ["image/jpeg", "image/png", "image/heic", "image/heif"],
  acceptedExtensions: [".jpg", ".jpeg", ".png", ".heic"],
}

export type UserFileRow = {
  id: string
  user_id: string
  purpose: UserFilePurpose
  storage_bucket: string
  storage_path: string
  mime_type: string
  byte_size: number
  checksum: string | null
  original_filename: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export type IngestUploadResult = {
  file: UserFileRow
  ingestRunId: string
  reusedExisting: boolean
  storagePath: string
}
