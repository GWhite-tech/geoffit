import type {
  BloodMarkerStatus,
  BloodReferenceRange,
} from "@/lib/domain/blood"

/**
 * Biomarker detected on the PDF but OCR could not read a reliable number.
 * Shown in import preview for manual entry before confirm.
 */
export interface BloodManualEntryMarker {
  name: string
  key: string
  unit: string
  referenceRange: BloodReferenceRange
  status: BloodMarkerStatus
  reason: string
}
