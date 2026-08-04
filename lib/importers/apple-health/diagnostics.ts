import type { AppleHealthDiagnostics, AppleHealthTypeCount } from "./types"
import type { ClassifiedTypeCount } from "./metric-counts"
import { formatMappingFunnelReport } from "./mapping-diagnostics"

function formatCount(count: number): string {
  return count.toLocaleString()
}

function formatTypeList(types: AppleHealthTypeCount[]): string {
  if (types.length === 0) return "  (none)"
  return types
    .map((entry) => `  ${entry.type}: ${formatCount(entry.count)}`)
    .join("\n")
}

function formatClassifiedList(types: ClassifiedTypeCount[]): string {
  if (types.length === 0) return "  (none)"
  return types
    .map(
      (entry) =>
        `  ${entry.label} (${entry.type}): ${formatCount(entry.count)}`
    )
    .join("\n")
}

/** Human-readable diagnostic report for Apple Health import failures. */
export function formatAppleHealthDiagnostics(
  diagnostics: AppleHealthDiagnostics
): string {
  const lines: string[] = [
    "Apple Health import diagnostics",
    "────────────────────────────────",
    `ZIP / file name: ${diagnostics.fileName}`,
    `Format: ${diagnostics.format}`,
  ]

  if (diagnostics.format === "zip") {
    lines.push(
      `Files contained in ZIP (${diagnostics.zipEntries.length}):`,
      ...(diagnostics.zipEntries.length > 0
        ? diagnostics.zipEntries.map((path) => `  - ${path}`)
        : ["  (none)"])
    )
  }

  lines.push(
    `XML file selected: ${diagnostics.selectedXmlPath ?? "(none)"}`,
    diagnostics.xmlByteLength !== null
      ? `XML size: ${formatCount(diagnostics.xmlByteLength)} bytes`
      : "XML size: unknown",
    `Total XML elements processed: ${formatCount(diagnostics.totalXmlElements)}`,
    `<Record> elements found: ${formatCount(diagnostics.recordElementCount)}`,
    `<Workout> elements found: ${formatCount(diagnostics.workoutElementCount)}`,
    `Supported records extracted: ${formatCount(diagnostics.supportedRecordCount)}`,
    `Apple Health detected: ${diagnostics.appleHealthDetected ? "yes" : "no"}`,
    "",
    "Supported",
    formatClassifiedList(diagnostics.classification.supported),
    "",
    "Detected",
    formatClassifiedList(diagnostics.classification.detected),
    "",
    "Disabled (profile)",
    formatClassifiedList(diagnostics.classification.disabled),
    "",
    "Ignored",
    formatClassifiedList(diagnostics.classification.ignored),
    "",
    "Unknown",
    formatClassifiedList(diagnostics.classification.unknown),
    "",
    "Top types (raw):",
    formatTypeList(diagnostics.topRecordTypes)
  )

  if (diagnostics.mappingFunnel) {
    lines.push("", formatMappingFunnelReport(diagnostics.mappingFunnel))
  }

  if (diagnostics.bodyCompositionTypeDiagnostics) {
    lines.push(
      "",
      "Body composition HealthKit types",
      diagnostics.bodyCompositionTypeDiagnostics.length === 0
        ? "  (none)"
        : diagnostics.bodyCompositionTypeDiagnostics
            .map((entry) =>
              entry.status === "unknown_body_composition"
                ? `  Unknown Body Composition Type: ${entry.type} (${formatCount(entry.count)})`
                : `  ${entry.label}: ${formatCount(entry.count)}`
            )
            .join("\n")
    )
    if (diagnostics.bodyCompositionSessionCount != null) {
      lines.push(
        `Body composition sessions (merged ≤5 min / same source): ${formatCount(diagnostics.bodyCompositionSessionCount)}`
      )
    }
  }

  if (diagnostics.malformedElements > 0) {
    lines.push(
      "",
      `Malformed elements skipped: ${formatCount(diagnostics.malformedElements)}`
    )
  }

  if (diagnostics.parseWarnings.length > 0) {
    lines.push(
      "",
      "Parse warnings:",
      ...diagnostics.parseWarnings
        .slice(0, 10)
        .map((warning) => `  - ${warning}`)
    )
  }

  if (!diagnostics.appleHealthDetected) {
    lines.push(
      "",
      "No HealthKit record types were detected. This does not appear to be a genuine Apple Health export."
    )
  } else if (
    diagnostics.supportedRecordCount === 0 &&
    diagnostics.classification.supported.length > 0
  ) {
    lines.push(
      "",
      "Supported types were detected but extraction produced 0 records.",
      "See Extraction funnel above for Detected → Mapped → Validated → Ready."
    )
  } else if (
    diagnostics.supportedRecordCount === 0 &&
    diagnostics.classification.detected.length > 0
  ) {
    lines.push(
      "",
      "Apple Health export confirmed, but no currently supported record types were extracted.",
      "Ignored types above can be added in a future importer pass."
    )
  } else if (
    diagnostics.supportedRecordCount === 0 &&
    diagnostics.totalXmlElements === 0
  ) {
    lines.push(
      "",
      "No XML elements were processed. The stream may be empty, unreadable, or the wrong file was selected."
    )
  }

  return lines.join("\n")
}
