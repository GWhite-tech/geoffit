import type { BloodTest } from "@/lib/domain/blood"
import type { ImportPreview } from "../ImportResult"
import {
  BaseImporter,
  type ParsedImportData,
  type ValidationResult,
} from "../Importer"
import {
  bloodTestsFromReviewRows,
  buildDiagnostics,
  type ScreenshotImportDiagnostics,
  type ScreenshotReviewRow,
} from "./ResultNormalizer"

export interface ScreenshotBloodTestMetadata {
  domainBloodTests: BloodTest[]
  /** First test — convenience for shared confirm helpers. */
  domainBloodTest?: BloodTest
  reviewRows: ScreenshotReviewRow[]
  diagnostics: ScreenshotImportDiagnostics
  extractWarnings: string[]
  provider: string
  panelName: string
}

/**
 * Client-safe screenshot blood-test importer.
 * OCR runs on the server; this class hydrates + previews + validates.
 */
export class ScreenshotBloodTestImporter extends BaseImporter {
  readonly id = "blood-test-screenshots"
  readonly name = "Blood Screenshots"
  readonly description =
    "Screenshots from NHS App, GP portals, hospital apps, and clinics"
  readonly supportedExtensions = [".png", ".jpg", ".jpeg", ".heic"]
  readonly supportedMimeTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/heic",
    "image/heif",
  ]
  readonly unsupportedFileMessage =
    "This importer only supports PNG, JPEG, or HEIC screenshots."

  async parse(_file: File): Promise<ParsedImportData> {
    throw new Error(
      "Blood screenshots must be parsed on the server. Upload via /api/import/blood-test-screenshots."
    )
  }

  hydrateFromServerResult(input: {
    bloodTests: BloodTest[]
    reviewRows: ScreenshotReviewRow[]
    diagnostics: ScreenshotImportDiagnostics
    warnings?: string[]
    fileName: string
  }): ParsedImportData {
    const warnings = input.warnings ?? []
    const bloodTests = input.bloodTests
    const metadata: ScreenshotBloodTestMetadata = {
      domainBloodTests: bloodTests,
      domainBloodTest: bloodTests[0],
      reviewRows: input.reviewRows,
      diagnostics: input.diagnostics,
      extractWarnings: warnings,
      provider: bloodTests[0]?.provider ?? "Screenshot import",
      panelName: bloodTests[0]?.panelName ?? "Blood screenshots",
    }

    const records = bloodTests.flatMap((test) =>
      test.markers.map((marker) =>
        this.createRecord({
          type: "blood_marker",
          category: "Blood Tests",
          label: marker.name,
          value: String(marker.value),
          unit: marker.unit || undefined,
          date: test.testDate === "unknown" ? "" : test.testDate,
          payload: {
            status: marker.status,
            referenceRange: marker.referenceRange,
            markerKey: marker.key,
            domainMarker: marker,
            domainBloodTestId: test.id,
            confidence: input.reviewRows.find(
              (row) =>
                row.biomarkerKey === marker.key &&
                row.date === test.testDate &&
                Number(row.value) === marker.value
            )?.confidence,
          },
        })
      )
    )

    return {
      fileName: input.fileName,
      records,
      metadata: {
        ...metadata,
      },
    }
  }

  /** Rebuild payload after inline review edits. */
  applyReviewRows(
    data: ParsedImportData,
    reviewRows: ScreenshotReviewRow[]
  ): ParsedImportData {
    const diagnostics =
      (data.metadata.diagnostics as ScreenshotImportDiagnostics | undefined) ??
      buildDiagnostics([], reviewRows)

    const bloodTests = bloodTestsFromReviewRows(reviewRows, {
      sourceFileName: data.fileName,
      provider:
        typeof data.metadata.provider === "string"
          ? data.metadata.provider
          : "Screenshot import",
      panelName:
        typeof data.metadata.panelName === "string"
          ? data.metadata.panelName
          : "Blood screenshots",
    })

    const nextDiagnostics: ScreenshotImportDiagnostics = {
      ...diagnostics,
      biomarkersDetected: reviewRows.filter(
        (r) => !r.excluded && !r.unknownBiomarker
      ).length,
      unknownBiomarkers: reviewRows.filter(
        (r) => !r.excluded && r.unknownBiomarker
      ).length,
      duplicateResults: reviewRows.filter((r) => r.duplicate).length,
      lowConfidenceCount: reviewRows.filter(
        (r) => !r.excluded && r.confidence < 0.65
      ).length,
    }

    return this.hydrateFromServerResult({
      bloodTests,
      reviewRows,
      diagnostics: nextDiagnostics,
      warnings: Array.isArray(data.metadata.extractWarnings)
        ? (data.metadata.extractWarnings as string[])
        : [],
      fileName: data.fileName,
    })
  }

  validate(data: ParsedImportData): ValidationResult {
    const tests = data.metadata.domainBloodTests as BloodTest[] | undefined
    const rows = data.metadata.reviewRows as ScreenshotReviewRow[] | undefined
    const warnings = Array.isArray(data.metadata.extractWarnings)
      ? (data.metadata.extractWarnings as string[])
      : []

    const errors: string[] = []
    const activeRows = (rows ?? []).filter((r) => !r.excluded)

    if (!rows || rows.length === 0) {
      errors.push("No biomarkers could be extracted from the screenshots.")
    } else if (activeRows.length === 0) {
      errors.push("All extracted rows are excluded. Keep at least one result.")
    }

    if ((!tests || tests.length === 0) && activeRows.length > 0) {
      // Rows exist but values missing — still allow preview; confirm gated in UI.
      warnings.push("Some rows are missing values — edit them before confirming.")
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  preview(data: ParsedImportData): ImportPreview {
    const tests = (data.metadata.domainBloodTests as BloodTest[] | undefined) ?? []
    const rows = (data.metadata.reviewRows as ScreenshotReviewRow[] | undefined) ?? []
    const diagnostics = data.metadata
      .diagnostics as ScreenshotImportDiagnostics | undefined
    const warnings = Array.isArray(data.metadata.extractWarnings)
      ? (data.metadata.extractWarnings as string[])
      : []

    const active = rows.filter((r) => !r.excluded)
    const dates = active
      .map((r) => r.date)
      .filter((d) => d && d !== "unknown")
      .sort()

    const markerCount = tests.reduce((sum, t) => sum + t.markers.length, 0)

    return {
      importerId: this.id,
      fileName: data.fileName,
      summary: `${diagnostics?.screensProcessed ?? 0} screenshot(s) · ${
        active.length
      } extracted result(s) · ${tests.length} test date(s).`,
      recordCount: markerCount || active.length,
      categories: [
        "Screenshot import",
        `${diagnostics?.screensProcessed ?? 0} screens`,
        `${active.length} results`,
      ],
      dateRange:
        dates.length > 0
          ? { start: dates[0]!, end: dates[dates.length - 1]! }
          : undefined,
      duplicateCount: diagnostics?.duplicateResults,
      rows: active.slice(0, 40).map((row) => ({
        id: row.id,
        category: row.status,
        label: row.biomarker,
        value: [row.value, row.unit].filter(Boolean).join(" "),
        date: row.date !== "unknown" ? row.date : undefined,
        status: row.status,
      })),
      warnings: [
        "Review OCR results carefully before confirming import.",
        ...warnings,
      ],
    }
  }
}
