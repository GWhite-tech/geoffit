import type { BloodMarker, BloodTest } from "@/lib/domain/blood"
import type { ImportPreview } from "../ImportResult"
import {
  BaseImporter,
  type ParsedImportData,
  type ValidationResult,
} from "../Importer"
import { buildBloodTestPreview } from "./BloodTestPreview"
import { validateBloodTestParse } from "./BloodTestValidator"
import type { BloodManualEntryMarker } from "./manual-entry"

export interface BloodTestMetadata {
  domainBloodTest: BloodTest
  pageCount?: number
  extractMethod?: "text" | "ocr" | "hybrid"
  extractWarnings: string[]
  provider: string
  panelName: string
  testDate: string
  outOfRangeCount: number
  /** Markers detected but missing a reliable OCR value — prompt for manual entry. */
  manualEntryRequired: BloodManualEntryMarker[]
}

export interface BloodTestApiResponse {
  success: boolean
  preview: ImportPreview | null
  biomarkers: BloodMarker[]
  warnings: string[]
  bloodTest?: BloodTest | null
  error?: string
}

/**
 * Blood-test importer — client-safe.
 * PDF parsing happens on the server via /api/import/blood-test.
 * This class only validates file types and hydrates server results for confirm/persist.
 */
export class BloodTestImporter extends BaseImporter {
  readonly id = "blood-test"
  readonly name = "Blood Test"
  readonly description = "PDF blood-test result reports"
  readonly supportedExtensions = [".pdf"]
  readonly supportedMimeTypes = ["application/pdf"]
  readonly unsupportedFileMessage =
    "This importer only supports PDF blood test reports."

  /**
   * Client-side parse is not supported — use the server API.
   */
  async parse(file: File): Promise<ParsedImportData> {
    const gate = this.validateFile(file)
    if (!gate.ok) {
      return {
        fileName: file.name,
        records: [],
        metadata: {
          fileRejected: true,
          rejectMessage: gate.message,
        },
      }
    }

    throw new Error(
      "Blood-test PDFs must be parsed on the server. Upload via /api/import/blood-test."
    )
  }

  /** Build import payload from a successful server parse response. */
  hydrateFromServerResult(
    bloodTest: BloodTest,
    warnings: string[] = [],
    manualEntryRequired: BloodManualEntryMarker[] = []
  ): ParsedImportData {
    const outOfRangeCount = bloodTest.markers.filter(
      (m) =>
        m.status === "high" || m.status === "low" || m.status === "critical"
    ).length

    const metadata: BloodTestMetadata = {
      domainBloodTest: bloodTest,
      extractWarnings: warnings,
      provider: bloodTest.provider,
      panelName: bloodTest.panelName,
      testDate: bloodTest.testDate,
      outOfRangeCount,
      manualEntryRequired,
    }

    const records = bloodTest.markers.map((marker) =>
      this.createRecord({
        type: "blood_marker",
        category: "Blood Tests",
        label: marker.name,
        value: String(marker.value),
        unit: marker.unit || undefined,
        date: bloodTest.testDate === "unknown" ? "" : bloodTest.testDate,
        payload: {
          status: marker.status,
          referenceRange: marker.referenceRange,
          markerKey: marker.key,
          domainMarker: marker,
          domainBloodTestId: bloodTest.id,
        },
      })
    )

    return {
      fileName: bloodTest.sourceFileName,
      records,
      metadata: {
        ...metadata,
        domainBloodTest: bloodTest,
      },
    }
  }

  validate(data: ParsedImportData): ValidationResult {
    if (data.metadata.fileRejected) {
      return {
        valid: false,
        errors: [
          typeof data.metadata.rejectMessage === "string"
            ? data.metadata.rejectMessage
            : this.unsupportedFileMessage,
        ],
        warnings: [],
      }
    }

    const bloodTest = data.metadata.domainBloodTest as BloodTest | undefined
    if (!bloodTest) {
      return {
        valid: false,
        errors: ["Missing structured blood-test payload."],
        warnings: [],
      }
    }

    const extractWarnings = Array.isArray(data.metadata.extractWarnings)
      ? (data.metadata.extractWarnings as string[])
      : []
    const manualEntryRequired = Array.isArray(data.metadata.manualEntryRequired)
      ? (data.metadata.manualEntryRequired as BloodManualEntryMarker[])
      : []

    return validateBloodTestParse({
      header: {
        provider: bloodTest.provider,
        panelName: bloodTest.panelName,
        patientName: bloodTest.patientName,
        sex: bloodTest.sex,
        testDate:
          bloodTest.testDate === "unknown" ? undefined : bloodTest.testDate,
        exportedAt: bloodTest.exportedAt,
      },
      markers: bloodTest.markers,
      clinicalReview: bloodTest.clinicalReview,
      warnings: extractWarnings,
      rawTextLength:
        bloodTest.markers.length > 0 || manualEntryRequired.length > 0
          ? 1000
          : 0,
      manualEntryRequired,
    })
  }

  preview(data: ParsedImportData): ImportPreview {
    const bloodTest = data.metadata.domainBloodTest as BloodTest
    const extractWarnings = Array.isArray(data.metadata.extractWarnings)
      ? (data.metadata.extractWarnings as string[])
      : []
    return buildBloodTestPreview(bloodTest, this.id, extractWarnings)
  }
}

/** @deprecated Use BloodTestImporter */
export const NumanBloodTestImporter = BloodTestImporter

/** Upload a PDF to the server blood-test parser. Safari only sends the file. */
export async function uploadBloodTestPdf(
  file: File
): Promise<BloodTestApiResponse> {
  const form = new FormData()
  form.append("file", file, file.name)

  const response = await fetch("/api/import/blood-test", {
    method: "POST",
    body: form,
  })

  const payload = (await response.json()) as BloodTestApiResponse
  return payload
}
