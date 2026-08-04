import type { ImportPreview } from "./ImportResult"
import {
  BaseImporter,
  type ParsedImportData,
  type ValidationResult,
} from "./Importer"

/** Generic CSV importer for weight logs, nutrition exports, blood panels, etc. */
export class CSVImporter extends BaseImporter {
  readonly id = "csv"
  readonly name = "CSV"
  readonly description = "Comma-separated health and fitness data"
  readonly supportedExtensions = [".csv"]
  readonly supportedMimeTypes = ["text/csv", "application/csv", "text/plain"]
  readonly unsupportedFileMessage =
    "This importer only supports CSV files."

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

    const text = await file.text()
    const lines = text.trim().split(/\r?\n/).filter(Boolean)

    if (lines.length < 2) {
      return {
        fileName: file.name,
        records: [],
        metadata: { rowCount: lines.length },
      }
    }

    const headers = this.parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim())
    const dateKey = headers.find((h) => ["date", "recorded_at", "timestamp"].includes(h))
    const valueKey = headers.find((h) => ["value", "amount", "weight", "result"].includes(h))
    const labelKey = headers.find((h) => ["label", "metric", "type", "name"].includes(h))
    const unitKey = headers.find((h) => ["unit", "units"].includes(h))

    const records = lines.slice(1).map((line, index) => {
      const cols = this.parseCsvLine(line)
      const row: Record<string, string> = {}
      headers.forEach((header, i) => {
        row[header] = cols[i] ?? ""
      })

      const label = labelKey ? row[labelKey] : headers[1] ?? "Metric"
      const value = valueKey ? row[valueKey] : cols[1] ?? ""
      const unit = unitKey ? row[unitKey] : undefined
      const date = dateKey
        ? row[dateKey]
        : new Date(Date.now() - index * 86400000).toISOString().split("T")[0]

      return this.createRecord({
        type: "csv_row",
        category: this.inferCategory(label),
        label,
        value,
        unit,
        date,
        payload: row,
      })
    })

    return {
      fileName: file.name,
      records,
      metadata: { headers, rowCount: lines.length - 1 },
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

    const errors: string[] = []
    const warnings: string[] = []

    if (data.records.length === 0) {
      errors.push("CSV must contain a header row and at least one data row.")
    }

    const missingValues = data.records.filter((r) => !r.value).length
    if (missingValues > 0) {
      warnings.push(`${missingValues} rows are missing values and will be skipped.`)
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  preview(data: ParsedImportData): ImportPreview {
    const categories = [...new Set(data.records.map((r) => r.category))]
    const validRecords = data.records.filter((r) => r.value)

    return {
      importerId: this.id,
      fileName: data.fileName,
      summary: `${validRecords.length} CSV rows mapped across ${categories.length} categories.`,
      recordCount: validRecords.length,
      categories,
      rows: validRecords.slice(0, 10).map((record) => ({
        id: record.id,
        category: record.category,
        label: record.label,
        value: record.unit ? `${record.value} ${record.unit}` : record.value,
        date: record.date,
      })),
      warnings: [],
    }
  }

  private parseCsvLine(line: string): string[] {
    return line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""))
  }

  private inferCategory(label: string): string {
    const lower = label.toLowerCase()
    if (lower.includes("weight") || lower.includes("waist")) return "Body"
    if (lower.includes("protein") || lower.includes("calorie")) return "Nutrition"
    if (lower.includes("sleep")) return "Sleep"
    if (lower.includes("hrv") || lower.includes("heart")) return "Recovery"
    return "General"
  }
}
