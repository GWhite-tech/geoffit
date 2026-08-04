import type { ClassifiedTypeCount } from "./metric-counts"
import type { MappingPipelineDiagnostics } from "./mapping-diagnostics"

export interface RawAppleHealthAttributes {
  type?: string
  sourceName?: string
  sourceVersion?: string
  device?: string
  creationDate?: string
  startDate?: string
  endDate?: string
  unit?: string
  value?: string
  workoutActivityType?: string
  duration?: string
  durationUnit?: string
  totalDistance?: string
  totalDistanceUnit?: string
  totalEnergyBurned?: string
  totalEnergyBurnedUnit?: string
}

export type RawAppleHealthElement =
  | { kind: "record"; attributes: RawAppleHealthAttributes }
  | { kind: "workout"; attributes: RawAppleHealthAttributes }

export interface AppleHealthTypeCount {
  type: string
  count: number
}

export interface TypeClassificationBreakdown {
  supported: ClassifiedTypeCount[]
  disabled: ClassifiedTypeCount[]
  ignored: ClassifiedTypeCount[]
  unknown: ClassifiedTypeCount[]
  detected: ClassifiedTypeCount[]
}

/** Diagnostic snapshot collected while opening and streaming an Apple Health export. */
export interface AppleHealthDiagnostics {
  fileName: string
  format: "xml" | "zip"
  zipEntries: string[]
  selectedXmlPath: string | null
  xmlByteLength: number | null
  totalXmlElements: number
  recordElementCount: number
  workoutElementCount: number
  supportedRecordCount: number
  topRecordTypes: AppleHealthTypeCount[]
  parseWarnings: string[]
  malformedElements: number
  appleHealthDetected: boolean
  classification: TypeClassificationBreakdown
  mappingFunnel?: MappingPipelineDiagnostics
  /** Body composition HK types found (supported + unknown-looking). */
  bodyCompositionTypeDiagnostics?: Array<{
    type: string
    label: string
    count: number
    status: "supported" | "unknown_body_composition"
  }>
  bodyCompositionSessionCount?: number
}

export interface AppleHealthParseResult {
  elements: RawAppleHealthElement[]
  warnings: string[]
  skippedElements: number
  malformedElements: number
  diagnostics: Omit<
    AppleHealthDiagnostics,
    | "fileName"
    | "format"
    | "zipEntries"
    | "selectedXmlPath"
    | "xmlByteLength"
    | "supportedRecordCount"
  >
}

export interface AppleHealthAnalysis {
  dateRange: { start: string; end: string } | null
  duplicateCount: number
  duplicateGroups: number
  countsByType: Record<string, number>
}
