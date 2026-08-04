import type { HealthMetricType, HealthRecord } from "@/lib/domain/health"
import { HEALTH_METRIC_LABELS } from "@/lib/domain/health"

export type MappingRejectReason =
  | "Missing value attribute"
  | "Missing startDate attribute"
  | "Missing endDate attribute"
  | "Invalid date format"
  | "Unit conversion failed"
  | "Missing workoutActivityType"
  | "Missing sleep value"
  | "Unknown record type"
  | "Validation schema mismatch"
  | string

export interface TypeMappingFunnel {
  key: string
  label: string
  detected: number
  mapped: number
  validated: number
  ready: number
  rejected: number
  skipped: number
  /** Dominant rejection reason when mapped === 0 and rejected > 0. */
  primaryRejectReason: string | null
  rejectReasons: Record<string, number>
}

export interface MappingPipelineDiagnostics {
  byType: TypeMappingFunnel[]
  totals: {
    detected: number
    mapped: number
    validated: number
    ready: number
    rejected: number
    skipped: number
  }
  errors: string[]
  mappingFailures: Record<string, number>
}

export function createEmptyFunnel(
  key: string,
  label: string
): TypeMappingFunnel {
  return {
    key,
    label,
    detected: 0,
    mapped: 0,
    validated: 0,
    ready: 0,
    rejected: 0,
    skipped: 0,
    primaryRejectReason: null,
    rejectReasons: {},
  }
}

export function funnelKeyForDomainType(type: HealthMetricType): string {
  return type
}

export function funnelLabelForDomainType(type: HealthMetricType): string {
  switch (type) {
    case "body_mass":
      return "Weight"
    case "body_fat_percentage":
      return "Body Fat %"
    case "lean_body_mass":
      return "Lean Body Mass"
    case "body_mass_index":
      return "Body Mass Index"
    case "waist_circumference":
      return "Waist"
    case "height":
      return "Height"
    case "sleep_analysis":
      return "Sleep"
    case "heart_rate":
      return "Heart Rate"
    case "resting_heart_rate":
      return "Resting Heart Rate"
    case "heart_rate_variability":
      return "HRV"
    case "vo2_max":
      return "VO₂ Max"
    case "workout":
      return "Workouts"
    default:
      return HEALTH_METRIC_LABELS[type] ?? type
  }
}

export function finalizeFunnels(
  funnels: Map<string, TypeMappingFunnel>
): MappingPipelineDiagnostics {
  const byType = [...funnels.values()]
    .filter((funnel) => funnel.detected > 0 || funnel.ready > 0)
    .sort((a, b) => b.detected - a.detected || a.label.localeCompare(b.label))

  for (const funnel of byType) {
    if (funnel.mapped === 0 && funnel.rejected > 0) {
      const top = Object.entries(funnel.rejectReasons).sort(
        (a, b) => b[1] - a[1]
      )[0]
      funnel.primaryRejectReason = top?.[0] ?? "Unknown rejection reason"
    }
  }

  const totals = byType.reduce(
    (acc, funnel) => {
      acc.detected += funnel.detected
      acc.mapped += funnel.mapped
      acc.validated += funnel.validated
      acc.ready += funnel.ready
      acc.rejected += funnel.rejected
      acc.skipped += funnel.skipped
      return acc
    },
    {
      detected: 0,
      mapped: 0,
      validated: 0,
      ready: 0,
      rejected: 0,
      skipped: 0,
    }
  )

  const errors: string[] = []
  const mappingFailures: Record<string, number> = {}

  for (const funnel of byType) {
    if (funnel.detected > 0 && funnel.mapped === 0) {
      const reason = funnel.primaryRejectReason ?? "Unknown"
      errors.push(
        `${funnel.label}: Detected ${funnel.detected.toLocaleString()}, Mapped 0, Rejected ${funnel.rejected.toLocaleString()}. Reason: ${reason}`
      )
      mappingFailures[funnel.key] = funnel.rejected
    }
  }

  return { byType, totals, errors, mappingFailures }
}

export function formatMappingFunnelReport(
  diagnostics: MappingPipelineDiagnostics
): string {
  const lines: string[] = [
    "Extraction funnel",
    "─────────────────",
    "Detected → Mapped → Validated → Ready",
    "",
  ]

  for (const funnel of diagnostics.byType) {
    lines.push(funnel.label)
    lines.push(`  Detected        ${funnel.detected.toLocaleString()}`)
    lines.push(`  Mapped          ${funnel.mapped.toLocaleString()}`)
    lines.push(`  Validated       ${funnel.validated.toLocaleString()}`)
    lines.push(`  Ready           ${funnel.ready.toLocaleString()}`)

    if (funnel.rejected > 0) {
      lines.push(`  Rejected        ${funnel.rejected.toLocaleString()}`)
    }
    if (funnel.skipped > 0) {
      lines.push(`  Skipped         ${funnel.skipped.toLocaleString()}`)
    }

    if (funnel.mapped === 0 && funnel.detected > 0) {
      lines.push(
        `  Validation failed: ${funnel.primaryRejectReason ?? "Unknown"}`
      )
      const reasons = Object.entries(funnel.rejectReasons)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
      for (const [reason, count] of reasons) {
        lines.push(`    - ${reason}: ${count.toLocaleString()}`)
      }
    }

    lines.push("")
  }

  lines.push(
    `Totals — Detected ${diagnostics.totals.detected.toLocaleString()} · Mapped ${diagnostics.totals.mapped.toLocaleString()} · Ready ${diagnostics.totals.ready.toLocaleString()}`
  )

  return lines.join("\n")
}

/** Light domain validation after mapping. */
export function validateMappedRecord(
  record: HealthRecord
): { ok: true } | { ok: false; reason: MappingRejectReason } {
  if (!record.startDate || Number.isNaN(Date.parse(record.startDate))) {
    return { ok: false, reason: "Validation schema mismatch" }
  }
  if (!record.endDate || Number.isNaN(Date.parse(record.endDate))) {
    return { ok: false, reason: "Validation schema mismatch" }
  }

  if (record.type === "workout") {
    if (!record.activityType) {
      return { ok: false, reason: "Validation schema mismatch" }
    }
    return { ok: true }
  }

  if (record.type === "sleep_analysis") {
    if (!record.sleepValue) {
      return { ok: false, reason: "Validation schema mismatch" }
    }
    return { ok: true }
  }

  if (!Number.isFinite(record.value)) {
    return { ok: false, reason: "Validation schema mismatch" }
  }

  return { ok: true }
}
