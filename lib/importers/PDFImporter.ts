import type { ImportPreview } from "./ImportResult"
import {
  BaseImporter,
  type ParsedImportData,
  type ValidationResult,
} from "./Importer"

/** PDF importer for lab reports and clinical documents — extraction mocked for now. */
export class PDFImporter extends BaseImporter {
  readonly id = "pdf"
  readonly name = "PDF"
  readonly description = "Lab reports and clinical PDF documents"
  readonly supportedExtensions = [".pdf"]
  readonly supportedMimeTypes = ["application/pdf"]
  readonly unsupportedFileMessage =
    "This importer only supports PDF blood test reports."

  async parse(file: File): Promise<ParsedImportData> {
    const records = this.extractMockLabResults(file.name)

    return {
      fileName: file.name,
      records,
      metadata: {
        pageCount: 3,
        documentType: "lab_report",
        fileSize: file.size,
      },
    }
  }

  validate(data: ParsedImportData): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (data.records.length === 0) {
      errors.push("No extractable biomarkers found in PDF.")
    }

    warnings.push(
      "PDF parsing uses mock extraction. Production will use document OCR and structured parsing."
    )

    return { valid: errors.length === 0, errors, warnings }
  }

  preview(data: ParsedImportData): ImportPreview {
    const categories = [...new Set(data.records.map((r) => r.category))]

    return {
      importerId: this.id,
      fileName: data.fileName,
      summary: `${data.records.length} biomarkers extracted from lab report.`,
      recordCount: data.records.length,
      categories,
      rows: data.records.map((record) => ({
        id: record.id,
        category: record.category,
        label: record.label,
        value: record.unit ? `${record.value} ${record.unit}` : record.value,
        date: record.date,
      })),
      warnings: [
        "Review extracted values carefully before confirming import.",
      ],
    }
  }

  private extractMockLabResults(fileName: string) {
    const panelDate = "2026-01-15"
    const markers = [
      { label: "HbA1c", value: "5.4", unit: "%", category: "Blood Tests" },
      { label: "LDL Cholesterol", value: "118", unit: "mg/dL", category: "Blood Tests" },
      { label: "HDL Cholesterol", value: "52", unit: "mg/dL", category: "Blood Tests" },
      { label: "Testosterone", value: "485", unit: "ng/dL", category: "Blood Tests" },
      { label: "Vitamin D", value: "38", unit: "ng/mL", category: "Blood Tests" },
      { label: "TSH", value: "2.1", unit: "mIU/L", category: "Blood Tests" },
    ]

    return markers.map((marker) =>
      this.createRecord({
        type: "lab_marker",
        category: marker.category,
        label: marker.label,
        value: marker.value,
        unit: marker.unit,
        date: panelDate,
        payload: { sourceFile: fileName, panel: "Comprehensive Metabolic" },
      })
    )
  }
}
