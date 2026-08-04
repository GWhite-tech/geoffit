import type { BloodTest } from "@/lib/domain/blood"
import type { ImportPreview } from "../ImportResult"
import {
  BaseImporter,
  type ParsedImportData,
  type ValidationResult,
} from "../Importer"
import {
  BIOMARKER_REGISTRY,
  matchBiomarker,
  slugifyUnknownBiomarker,
} from "./BiomarkerMatcher"
import {
  bloodTestsFromReviewRows,
  inferStatus,
  parseReferenceRangeText,
  rematchReviewRow,
  type ScreenshotReviewRow,
} from "./ResultNormalizer"

export interface ManualBloodEntryRow {
  id: string
  date: string
  biomarkerKey: string
  biomarker: string
  value: string
  unit: string
}

export function createEmptyManualRow(): ManualBloodEntryRow {
  return {
    id: crypto.randomUUID(),
    date: "",
    biomarkerKey: "",
    biomarker: "",
    value: "",
    unit: "",
  }
}

export function applyBiomarkerSelection(
  row: ManualBloodEntryRow,
  keyOrName: string
): ManualBloodEntryRow {
  const fromRegistry = BIOMARKER_REGISTRY.find((b) => b.key === keyOrName)
  if (fromRegistry) {
    return {
      ...row,
      biomarkerKey: fromRegistry.key,
      biomarker: fromRegistry.displayName,
      unit: row.unit || fromRegistry.defaultUnit || "",
    }
  }

  const matched = matchBiomarker(keyOrName)
  if (matched) {
    return {
      ...row,
      biomarkerKey: matched.biomarker.key,
      biomarker: matched.biomarker.displayName,
      unit: row.unit || matched.biomarker.defaultUnit || "",
    }
  }

  return {
    ...row,
    biomarker: keyOrName,
    biomarkerKey: slugifyUnknownBiomarker(keyOrName),
  }
}

function toReviewRows(rows: ManualBloodEntryRow[]): ScreenshotReviewRow[] {
  return rows
    .filter((row) => {
      const value = Number(String(row.value).replace(/,/g, "").trim())
      return row.date.trim() && row.biomarker.trim() && Number.isFinite(value)
    })
    .map((row) => {
      const rematched = rematchReviewRow({
        id: row.id,
        date: row.date.trim(),
        biomarker: row.biomarker.trim(),
        biomarkerKey: row.biomarkerKey || slugifyUnknownBiomarker(row.biomarker),
        value: String(row.value).trim(),
        unit: row.unit.trim(),
        referenceRange: "—",
        status: "unknown",
        confidence: 1,
        sourceFileName: "manual-entry",
        unknownBiomarker: !row.biomarkerKey,
        duplicate: false,
      })

      const value = Number(String(rematched.value).replace(/,/g, "").trim())
      const range = parseReferenceRangeText(rematched.referenceRange)

      return {
        ...rematched,
        status: inferStatus(value, range),
        unknownBiomarker: !BIOMARKER_REGISTRY.some(
          (b) => b.key === rematched.biomarkerKey
        ),
      }
    })
}

/**
 * Client-only manual blood entry — no file upload / OCR.
 */
export class ManualBloodTestImporter extends BaseImporter {
  readonly id = "blood-test-manual"
  readonly name = "Manual Blood Entry"
  readonly description = "Type date, biomarker, and value by hand"
  readonly supportedExtensions: string[] = []
  readonly supportedMimeTypes: string[] = []
  readonly unsupportedFileMessage =
    "Manual blood entry does not accept file uploads."

  async parse(_file: File): Promise<ParsedImportData> {
    throw new Error("Manual blood entry does not parse files.")
  }

  hydrateFromRows(rows: ManualBloodEntryRow[]): ParsedImportData {
    const reviewRows = toReviewRows(rows)
    const bloodTests = bloodTestsFromReviewRows(reviewRows, {
      sourceFileName: "manual-entry",
      provider: "Manual entry",
      panelName: "Manual blood markers",
      source: this.id,
    })

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
            markerKey: marker.key,
            domainMarker: marker,
            domainBloodTestId: test.id,
          },
        })
      )
    )

    return {
      fileName: "manual-entry",
      records,
      metadata: {
        domainBloodTests: bloodTests,
        domainBloodTest: bloodTests[0],
        reviewRows,
        manualRows: rows,
        provider: "Manual entry",
        panelName: "Manual blood markers",
        extractWarnings: [],
      },
    }
  }

  validate(data: ParsedImportData): ValidationResult {
    const tests = data.metadata.domainBloodTests as BloodTest[] | undefined
    if (!tests || tests.length === 0) {
      return {
        valid: false,
        errors: ["Add at least one row with date, biomarker, and value."],
        warnings: [],
      }
    }
    return { valid: true, errors: [], warnings: [] }
  }

  preview(data: ParsedImportData): ImportPreview {
    const tests = (data.metadata.domainBloodTests as BloodTest[] | undefined) ?? []
    const markerCount = tests.reduce((sum, t) => sum + t.markers.length, 0)
    const dates = tests
      .map((t) => t.testDate)
      .filter((d) => d !== "unknown")
      .sort()

    return {
      importerId: this.id,
      fileName: "Manual entry",
      summary: `${markerCount} biomarker(s) across ${tests.length} date(s).`,
      recordCount: markerCount,
      categories: ["Manual entry", `${markerCount} markers`],
      dateRange:
        dates.length > 0
          ? { start: dates[0]!, end: dates[dates.length - 1]! }
          : undefined,
      rows: tests.flatMap((test) =>
        test.markers.map((marker) => ({
          id: marker.id,
          category: marker.status,
          label: marker.name,
          value: [marker.value, marker.unit].filter(Boolean).join(" "),
          date: test.testDate !== "unknown" ? test.testDate : undefined,
          status: marker.status,
        }))
      ),
      warnings: [],
    }
  }
}
