/**
 * Canonical clinical biomarker registry — single source of truth for
 * display, units, ranges, status evaluation, colours, and chart config.
 * Never hardcode thresholds in UI components.
 */

export type BiomarkerCategory =
  | "hormones"
  | "lipids"
  | "diabetes"
  | "liver"
  | "kidney"
  | "thyroid"
  | "iron"
  | "full_blood_count"
  | "white_blood_cells"
  | "other"

export const BIOMARKER_CATEGORY_LABELS: Record<BiomarkerCategory, string> = {
  hormones: "Hormones",
  lipids: "Lipids",
  diabetes: "Diabetes",
  liver: "Liver",
  kidney: "Kidney",
  thyroid: "Thyroid",
  iron: "Iron",
  full_blood_count: "Full Blood Count",
  white_blood_cells: "White Blood Cells",
  other: "Other",
}

export type BiomarkerStatusId =
  | "optimal"
  | "normal"
  | "borderline"
  | "low"
  | "very_low"
  | "high"
  | "critical_low"
  | "critical_high"
  | "at_risk"
  | "diabetic"
  | "poor_control"
  | "unknown"

export type BiomarkerStatusColor = "green" | "amber" | "red" | "muted"

export const BIOMARKER_COLOR_CLASS: Record<BiomarkerStatusColor, string> = {
  green: "text-success",
  amber: "text-warning",
  red: "text-destructive",
  muted: "text-muted-foreground",
}

export const BIOMARKER_STATUS_COLOR: Record<
  BiomarkerStatusId,
  BiomarkerStatusColor
> = {
  optimal: "green",
  normal: "green",
  borderline: "amber",
  low: "amber",
  very_low: "red",
  high: "amber",
  at_risk: "amber",
  diabetic: "amber",
  critical_low: "red",
  critical_high: "red",
  poor_control: "red",
  unknown: "muted",
}

export const BIOMARKER_STATUS_LABEL: Record<BiomarkerStatusId, string> = {
  optimal: "Optimal",
  normal: "Normal",
  borderline: "Borderline",
  low: "Low",
  very_low: "Very Low",
  high: "High",
  critical_low: "Critical Low",
  critical_high: "Critical High",
  at_risk: "At Risk",
  diabetic: "Diabetic",
  poor_control: "Poor Control",
  unknown: "Unknown",
}

/** How to interpret values relative to reference bounds. */
export type BiomarkerInterpretation =
  | "two_sided"
  | "lower_is_better"
  | "higher_is_better"

export interface NumericRange {
  low?: number
  high?: number
  text: string
}

export interface BiomarkerRangeBand {
  min?: number
  max?: number
  minExclusive?: boolean
  maxExclusive?: boolean
  statusId: BiomarkerStatusId
  /** Override default label from BIOMARKER_STATUS_LABEL. */
  label?: string
}

export interface BiomarkerChartConfig {
  color: string
  preferredDecimals: number
  /** Extra headroom above/below data when scaling charts (0–1). */
  yPaddingFraction: number
}

/**
 * Context for future sex / age / lab / unit-specific ranges.
 * evaluateStatus already accepts this without UI changes.
 */
export interface BiomarkerEvaluationContext {
  sex?: "male" | "female" | "other"
  ageYears?: number
  laboratoryId?: string
  unitSystem?: "si" | "conventional"
}

export interface ResolvedBiomarkerStatus {
  statusId: BiomarkerStatusId
  label: string
  colour: BiomarkerStatusColor
  colorClass: string
}

export interface DualBiomarkerInterpretation {
  clinical: ResolvedBiomarkerStatus
  laboratory: ResolvedBiomarkerStatus
  /** Imported lab range when available, otherwise registry laboratory fallback. */
  laboratoryRange: NumericRange
  laboratoryRangeDisplay: string
  hasClinicalModel: boolean
  differs: boolean
  explanation: string | null
}

export interface BiomarkerDefinition {
  id: string
  displayName: string
  shortName: string
  category: BiomarkerCategory
  unit: string
  aliases: string[]
  description: string
  /**
   * Default laboratory reference range (fallback when an import has no range).
   * Independent of Geoffit clinical thresholds.
   */
  referenceRange: NumericRange
  optimalRange?: NumericRange
  criticalLow?: number
  criticalHigh?: number
  interpretation: BiomarkerInterpretation
  /** When set, replaces the default low/normal/high evaluator (e.g. HbA1c). */
  statusBands?: BiomarkerRangeBand[]
  /**
   * Geoffit clinical optimisation bands — independent of laboratory ranges.
   * When present, primary UI status uses clinical evaluation.
   */
  clinicalBands?: BiomarkerRangeBand[]
  /** Optional future overrides — ignored until populated. */
  rangesBySex?: Partial<
    Record<"male" | "female", { referenceRange: NumericRange; optimalRange?: NumericRange }>
  >
  sortOrder: number
  showOnMissionControl: boolean
  chart: BiomarkerChartConfig
  /** Primary status — clinical when clinicalBands exist, otherwise registry model. */
  evaluateStatus: (
    value: number,
    context?: BiomarkerEvaluationContext
  ) => ResolvedBiomarkerStatus
  evaluateClinicalStatus: (
    value: number,
    context?: BiomarkerEvaluationContext
  ) => ResolvedBiomarkerStatus
  evaluateLaboratoryStatus: (
    value: number,
    laboratoryRange?: Partial<NumericRange> | null,
    context?: BiomarkerEvaluationContext
  ) => ResolvedBiomarkerStatus
  interpretDual: (
    value: number,
    laboratoryRange?: Partial<NumericRange> | null,
    context?: BiomarkerEvaluationContext
  ) => DualBiomarkerInterpretation
}

type BiomarkerConfig = Omit<
  BiomarkerDefinition,
  | "evaluateStatus"
  | "evaluateClinicalStatus"
  | "evaluateLaboratoryStatus"
  | "interpretDual"
  | "chart"
> & {
  chart?: Partial<BiomarkerChartConfig>
}

function bandMatches(value: number, band: BiomarkerRangeBand): boolean {
  if (band.min != null) {
    if (band.minExclusive ? !(value > band.min) : !(value >= band.min)) return false
  }
  if (band.max != null) {
    if (band.maxExclusive ? !(value < band.max) : !(value <= band.max)) return false
  }
  return true
}

function inRange(value: number, range?: NumericRange): boolean {
  if (!range) return false
  if (range.low != null && value < range.low) return false
  if (range.high != null && value > range.high) return false
  return range.low != null || range.high != null
}

function resolveReference(
  def: BiomarkerConfig,
  context?: BiomarkerEvaluationContext
): { referenceRange: NumericRange; optimalRange?: NumericRange } {
  const sex = context?.sex
  if (sex === "male" || sex === "female") {
    const sexRanges = def.rangesBySex?.[sex]
    if (sexRanges) {
      return {
        referenceRange: sexRanges.referenceRange,
        optimalRange: sexRanges.optimalRange ?? def.optimalRange,
      }
    }
  }
  return {
    referenceRange: def.referenceRange,
    optimalRange: def.optimalRange,
  }
}

function evaluateDefaultStatus(
  def: BiomarkerConfig,
  value: number,
  context?: BiomarkerEvaluationContext
): ResolvedBiomarkerStatus {
  const unknown: ResolvedBiomarkerStatus = {
    statusId: "unknown",
    label: BIOMARKER_STATUS_LABEL.unknown,
    colour: "muted",
    colorClass: BIOMARKER_COLOR_CLASS.muted,
  }
  if (!Number.isFinite(value)) return unknown

  const { referenceRange, optimalRange } = resolveReference(def, context)
  const { interpretation, criticalLow, criticalHigh } = def

  if (criticalLow != null && value < criticalLow) {
    return statusResult("critical_low")
  }
  if (criticalHigh != null && value > criticalHigh) {
    return statusResult("critical_high")
  }

  if (interpretation === "higher_is_better") {
    if (optimalRange?.low != null && value >= optimalRange.low) {
      if (optimalRange.high == null || value <= optimalRange.high) {
        return statusResult("optimal")
      }
    }
    if (referenceRange.low != null && value < referenceRange.low) {
      return statusResult("low")
    }
    if (referenceRange.high != null && value > referenceRange.high) {
      return statusResult("high")
    }
    if (inRange(value, referenceRange)) return statusResult("normal")
    return unknown
  }

  if (interpretation === "lower_is_better") {
    if (optimalRange?.high != null && value <= optimalRange.high) {
      if (optimalRange.low == null || value >= optimalRange.low) {
        return statusResult("optimal")
      }
    }
    if (referenceRange.high != null && value > referenceRange.high) {
      return statusResult("high")
    }
    if (referenceRange.low != null && value < referenceRange.low) {
      return statusResult("low")
    }
    if (inRange(value, referenceRange)) return statusResult("normal")
    return unknown
  }

  // two_sided
  if (inRange(value, optimalRange)) return statusResult("optimal")
  if (referenceRange.low != null && value < referenceRange.low) {
    return statusResult("low")
  }
  if (referenceRange.high != null && value > referenceRange.high) {
    return statusResult("high")
  }
  if (inRange(value, referenceRange)) return statusResult("normal")
  return unknown
}

function statusResult(
  statusId: BiomarkerStatusId,
  label?: string
): ResolvedBiomarkerStatus {
  const colour = BIOMARKER_STATUS_COLOR[statusId]
  return {
    statusId,
    label: label ?? BIOMARKER_STATUS_LABEL[statusId],
    colour,
    colorClass: BIOMARKER_COLOR_CLASS[colour],
  }
}

function evaluateAgainstBands(
  value: number,
  bands: BiomarkerRangeBand[]
): ResolvedBiomarkerStatus {
  for (const band of bands) {
    if (!bandMatches(value, band)) continue
    return statusResult(band.statusId, band.label)
  }
  return statusResult("unknown")
}

function evaluateClinicalStatus(
  def: BiomarkerConfig,
  value: number,
  context?: BiomarkerEvaluationContext
): ResolvedBiomarkerStatus {
  if (!Number.isFinite(value)) return statusResult("unknown")

  if (def.clinicalBands && def.clinicalBands.length > 0) {
    return evaluateAgainstBands(value, def.clinicalBands)
  }

  // No dedicated clinical model — fall back to the registry clinical/status model.
  if (def.statusBands && def.statusBands.length > 0) {
    return evaluateAgainstBands(value, def.statusBands)
  }

  return evaluateDefaultStatus(def, value, context)
}

function evaluateLaboratoryStatus(
  def: BiomarkerConfig,
  value: number,
  laboratoryRange?: Partial<NumericRange> | null,
  context?: BiomarkerEvaluationContext
): ResolvedBiomarkerStatus {
  if (!Number.isFinite(value)) return statusResult("unknown")

  const fallback = resolveReference(def, context).referenceRange
  const range: NumericRange = {
    low: laboratoryRange?.low ?? fallback.low,
    high: laboratoryRange?.high ?? fallback.high,
    text: laboratoryRange?.text?.trim() || fallback.text,
  }

  if (range.low == null && range.high == null) return statusResult("unknown")
  if (range.low != null && value < range.low) return statusResult("low")
  if (range.high != null && value > range.high) return statusResult("high")
  return statusResult("normal")
}

function resolveLaboratoryRange(
  def: BiomarkerConfig,
  laboratoryRange?: Partial<NumericRange> | null,
  context?: BiomarkerEvaluationContext
): NumericRange {
  const fallback = resolveReference(def, context).referenceRange
  return {
    low: laboratoryRange?.low ?? fallback.low,
    high: laboratoryRange?.high ?? fallback.high,
    text: laboratoryRange?.text?.trim() || fallback.text,
  }
}

function formatLaboratoryRangeDisplay(range: NumericRange, unit: string): string {
  const text = range.text || "—"
  return unit ? `${text} ${unit}` : text
}

function clinicalOptimisationThreshold(
  def: BiomarkerConfig
): number | null {
  if (!def.clinicalBands?.length) return null
  const borderline = def.clinicalBands.find((band) => band.statusId === "borderline")
  if (borderline?.min != null) return borderline.min
  const optimal = def.clinicalBands.find((band) => band.statusId === "optimal")
  return optimal?.min ?? null
}

function explainDualInterpretation(
  def: BiomarkerConfig,
  value: number,
  clinical: ResolvedBiomarkerStatus,
  laboratory: ResolvedBiomarkerStatus,
  laboratoryRange: NumericRange
): string | null {
  if (!def.clinicalBands?.length) return null
  if (clinical.statusId === laboratory.statusId) return null

  const labInRange = laboratory.statusId === "normal"
  const clinicalBelowOptimal =
    clinical.statusId === "low" ||
    clinical.statusId === "very_low" ||
    clinical.statusId === "borderline"
  const threshold = clinicalOptimisationThreshold(def)

  if (labInRange && clinicalBelowOptimal && threshold != null) {
    const formatted =
      def.chart?.preferredDecimals === 0
        ? Math.round(threshold).toString()
        : threshold.toFixed(def.chart?.preferredDecimals ?? 1).replace(/\.?0+$/, "")
    const unitSuffix = def.unit ? ` ${def.unit}` : ""
    return `This result falls within the laboratory reference range but is below Geoffit's clinical optimisation threshold of ${formatted}${unitSuffix}.`
  }

  if (!labInRange && (clinical.statusId === "optimal" || clinical.statusId === "normal")) {
    return `This result is outside the laboratory reference range (${formatLaboratoryRangeDisplay(laboratoryRange, def.unit)}) but meets Geoffit's clinical interpretation of ${clinical.label.toLowerCase()}.`
  }

  return `Laboratory status is ${laboratory.label.toLowerCase()} while Geoffit's clinical status is ${clinical.label.toLowerCase()}.`
}

function evaluatePrimaryStatus(
  def: BiomarkerConfig,
  value: number,
  context?: BiomarkerEvaluationContext
): ResolvedBiomarkerStatus {
  if (!Number.isFinite(value)) return statusResult("unknown")

  // Clinical model is primary when configured.
  if (def.clinicalBands && def.clinicalBands.length > 0) {
    return evaluateClinicalStatus(def, value, context)
  }

  if (def.statusBands && def.statusBands.length > 0) {
    return evaluateAgainstBands(value, def.statusBands)
  }

  return evaluateDefaultStatus(def, value, context)
}

function createBiomarker(config: BiomarkerConfig): BiomarkerDefinition {
  const chart: BiomarkerChartConfig = {
    color: "var(--primary)",
    preferredDecimals: 1,
    yPaddingFraction: 0.12,
    ...config.chart,
  }

  const def = {
    ...config,
    chart,
    evaluateStatus(value: number, context?: BiomarkerEvaluationContext) {
      return evaluatePrimaryStatus(config, value, context)
    },
    evaluateClinicalStatus(
      value: number,
      context?: BiomarkerEvaluationContext
    ) {
      return evaluateClinicalStatus(config, value, context)
    },
    evaluateLaboratoryStatus(
      value: number,
      laboratoryRange?: Partial<NumericRange> | null,
      context?: BiomarkerEvaluationContext
    ) {
      return evaluateLaboratoryStatus(config, value, laboratoryRange, context)
    },
    interpretDual(
      value: number,
      laboratoryRange?: Partial<NumericRange> | null,
      context?: BiomarkerEvaluationContext
    ): DualBiomarkerInterpretation {
      const clinical = evaluateClinicalStatus(config, value, context)
      const laboratory = evaluateLaboratoryStatus(
        config,
        value,
        laboratoryRange,
        context
      )
      const resolvedLabRange = resolveLaboratoryRange(
        config,
        laboratoryRange,
        context
      )
      const hasClinicalModel = Boolean(config.clinicalBands?.length)
      return {
        clinical,
        laboratory,
        laboratoryRange: resolvedLabRange,
        laboratoryRangeDisplay: formatLaboratoryRangeDisplay(
          resolvedLabRange,
          config.unit
        ),
        hasClinicalModel,
        differs:
          hasClinicalModel && clinical.statusId !== laboratory.statusId,
        explanation: explainDualInterpretation(
          { ...config, chart },
          value,
          clinical,
          laboratory,
          resolvedLabRange
        ),
      }
    },
  } satisfies BiomarkerDefinition

  return def
}

const DEFAULT_CHART = {
  color: "var(--primary)",
  preferredDecimals: 1,
  yPaddingFraction: 0.12,
} as const

/**
 * Full Numan panel + Mission Control favourites.
 * Ranges are typical UK adult male SI lab references (Numan-aligned).
 * Sex-specific overrides can be added via rangesBySex without UI changes.
 */
export const BIOMARKER_REGISTRY: BiomarkerDefinition[] = [
  // —— Hormones ——
  createBiomarker({
    id: "testosterone",
    displayName: "Total Testosterone",
    shortName: "Testosterone",
    category: "hormones",
    unit: "nmol/L",
    aliases: ["testosterone", "total_testosterone"],
    description:
      "Primary male sex hormone. Supports muscle, bone, mood, libido, and metabolic health.",
    // Default laboratory reference — overridden by imported lab ranges when present.
    referenceRange: { low: 8.64, high: 29.0, text: "8.64–29.0" },
    optimalRange: { low: 15, high: 30, text: "15–30" },
    criticalLow: 5,
    interpretation: "two_sided",
    // Geoffit clinical thresholds — independent of laboratory ranges.
    clinicalBands: [
      { max: 8, maxExclusive: true, statusId: "very_low", label: "Very Low" },
      { min: 8, max: 11.9, statusId: "low" },
      { min: 12, max: 15, maxExclusive: true, statusId: "borderline" },
      { min: 15, max: 30, statusId: "optimal" },
      { min: 30, minExclusive: true, statusId: "high" },
    ],
    sortOrder: 10,
    showOnMissionControl: true,
    chart: { ...DEFAULT_CHART, preferredDecimals: 1 },
  }),
  createBiomarker({
    id: "free_testosterone",
    displayName: "Free Testosterone",
    shortName: "Free T",
    category: "hormones",
    unit: "nmol/L",
    aliases: ["free_testosterone"],
    description:
      "Unbound testosterone available to tissues. Often more informative than total T when SHBG is abnormal.",
    // Typical UK lab SI range (e.g. Numan) — overridden by imported lab ranges when present.
    referenceRange: { low: 0.225, high: 1.073, text: "0.225–1.073" },
    optimalRange: { low: 0.45, high: 1.073, text: "0.45–1.073" },
    criticalLow: 0.1,
    interpretation: "two_sided",
    sortOrder: 20,
    showOnMissionControl: true,
    chart: { ...DEFAULT_CHART, preferredDecimals: 3 },
  }),
  createBiomarker({
    id: "estradiol",
    displayName: "Oestradiol",
    shortName: "Oestradiol",
    category: "hormones",
    unit: "pmol/L",
    aliases: ["estradiol", "oestradiol"],
    description:
      "Form of oestrogen. In men, balance with testosterone matters for joints, mood, and cardiovascular health.",
    referenceRange: { low: 40, high: 160, text: "40–160" },
    interpretation: "two_sided",
    sortOrder: 30,
    showOnMissionControl: true,
  }),
  createBiomarker({
    id: "shbg",
    displayName: "SHBG",
    shortName: "SHBG",
    category: "hormones",
    unit: "nmol/L",
    aliases: ["shbg"],
    description:
      "Sex hormone-binding globulin. Binds testosterone and oestradiol, modulating free hormone levels.",
    referenceRange: { low: 18.3, high: 54.1, text: "18.3–54.1" },
    interpretation: "two_sided",
    sortOrder: 40,
    showOnMissionControl: false,
  }),
  createBiomarker({
    id: "fai",
    displayName: "FAI",
    shortName: "FAI",
    category: "hormones",
    unit: "",
    aliases: ["fai"],
    description:
      "Free Androgen Index — estimated from total testosterone and SHBG.",
    referenceRange: { low: 24, high: 104, text: "24–104" },
    interpretation: "two_sided",
    sortOrder: 50,
    showOnMissionControl: false,
    chart: { ...DEFAULT_CHART, preferredDecimals: 0 },
  }),
  createBiomarker({
    id: "fsh",
    displayName: "FSH",
    shortName: "FSH",
    category: "hormones",
    unit: "IU/L",
    aliases: ["fsh"],
    description:
      "Follicle-stimulating hormone. Reflects pituitary signalling to the testes.",
    referenceRange: { low: 1.5, high: 12.4, text: "1.5–12.4" },
    interpretation: "two_sided",
    sortOrder: 60,
    showOnMissionControl: false,
  }),
  createBiomarker({
    id: "lh",
    displayName: "LH",
    shortName: "LH",
    category: "hormones",
    unit: "IU/L",
    aliases: ["lh"],
    description:
      "Luteinising hormone. Stimulates testicular testosterone production.",
    referenceRange: { low: 1.7, high: 8.6, text: "1.7–8.6" },
    interpretation: "two_sided",
    sortOrder: 70,
    showOnMissionControl: false,
  }),
  createBiomarker({
    id: "prolactin",
    displayName: "Prolactin",
    shortName: "Prolactin",
    category: "hormones",
    unit: "mU/L",
    aliases: ["prolactin"],
    description:
      "Pituitary hormone. Markedly elevated levels can suppress testosterone and affect sexual function.",
    referenceRange: { low: 86, high: 324, text: "86–324" },
    criticalHigh: 1000,
    interpretation: "two_sided",
    sortOrder: 80,
    showOnMissionControl: false,
    chart: { ...DEFAULT_CHART, preferredDecimals: 0 },
  }),
  createBiomarker({
    id: "psa",
    displayName: "PSA",
    shortName: "PSA",
    category: "hormones",
    unit: "ug/L",
    aliases: ["psa"],
    description:
      "Prostate-specific antigen. Used to monitor prostate health, especially on testosterone therapy.",
    referenceRange: { high: 2.5, text: "<2.5" },
    criticalHigh: 4,
    interpretation: "lower_is_better",
    sortOrder: 90,
    showOnMissionControl: false,
    chart: { ...DEFAULT_CHART, preferredDecimals: 2 },
  }),

  // —— Diabetes ——
  createBiomarker({
    id: "hba1c",
    displayName: "HbA1c",
    shortName: "HbA1c",
    category: "diabetes",
    unit: "mmol/mol",
    aliases: ["hba1c"],
    description:
      "Glycated haemoglobin (UK IFCC). Reflects average blood glucose over ~2–3 months.",
    referenceRange: { low: 20, high: 41, text: "20–41" },
    optimalRange: { low: 20, high: 41, text: "20–41" },
    interpretation: "lower_is_better",
    statusBands: [
      { max: 20, maxExclusive: true, statusId: "low", label: "Low" },
      { min: 20, max: 41, statusId: "optimal", label: "Optimal" },
      { min: 42, max: 47, statusId: "at_risk", label: "At Risk" },
      { min: 48, max: 58, statusId: "diabetic", label: "Diabetic" },
      {
        min: 58,
        minExclusive: true,
        statusId: "poor_control",
        label: "Poor Control",
      },
    ],
    sortOrder: 100,
    showOnMissionControl: true,
    chart: { ...DEFAULT_CHART, preferredDecimals: 0 },
  }),

  // —— Lipids ——
  createBiomarker({
    id: "cholesterol",
    displayName: "Total Cholesterol",
    shortName: "Cholesterol",
    category: "lipids",
    unit: "mmol/L",
    aliases: ["cholesterol", "total_cholesterol"],
    description: "Total circulating cholesterol. Context with HDL, LDL, and triglycerides matters most.",
    referenceRange: { high: 5.0, text: "<5.0" },
    optimalRange: { high: 5.0, text: "<5.0" },
    criticalHigh: 7.5,
    interpretation: "lower_is_better",
    sortOrder: 110,
    showOnMissionControl: true,
  }),
  createBiomarker({
    id: "hdl",
    displayName: "HDL",
    shortName: "HDL",
    category: "lipids",
    unit: "mmol/L",
    aliases: ["hdl"],
    description:
      "High-density lipoprotein — protective cholesterol fraction. Higher is generally better in men when >1.0.",
    referenceRange: { low: 1.0, text: ">1.0" },
    optimalRange: { low: 1.2, text: ">1.2" },
    criticalLow: 0.7,
    interpretation: "higher_is_better",
    sortOrder: 120,
    showOnMissionControl: true,
  }),
  createBiomarker({
    id: "ldl",
    displayName: "LDL",
    shortName: "LDL",
    category: "lipids",
    unit: "mmol/L",
    aliases: ["ldl"],
    description:
      "Low-density lipoprotein — atherogenic cholesterol. Lower is generally better for cardiovascular risk.",
    referenceRange: { high: 3.0, text: "<3.0" },
    optimalRange: { high: 2.6, text: "<2.6" },
    criticalHigh: 4.9,
    interpretation: "lower_is_better",
    sortOrder: 130,
    showOnMissionControl: true,
  }),
  createBiomarker({
    id: "triglycerides",
    displayName: "Triglycerides",
    shortName: "Triglycerides",
    category: "lipids",
    unit: "mmol/L",
    aliases: ["triglycerides"],
    description:
      "Blood fats closely linked to diet, alcohol, insulin resistance, and cardiovascular risk.",
    referenceRange: { high: 1.7, text: "<1.7" },
    optimalRange: { high: 1.2, text: "<1.2" },
    criticalHigh: 5.0,
    interpretation: "lower_is_better",
    sortOrder: 140,
    showOnMissionControl: true,
  }),
  createBiomarker({
    id: "non_hdl_cholesterol",
    displayName: "Non-HDL Cholesterol",
    shortName: "Non-HDL",
    category: "lipids",
    unit: "mmol/L",
    aliases: ["non_hdl_cholesterol", "non_hdl"],
    description:
      "Total cholesterol minus HDL — captures all atherogenic lipoproteins.",
    referenceRange: { high: 3.9, text: "<3.9" },
    optimalRange: { high: 3.4, text: "<3.4" },
    interpretation: "lower_is_better",
    sortOrder: 150,
    showOnMissionControl: false,
  }),
  createBiomarker({
    id: "cholesterol_hdl_ratio",
    displayName: "Cholesterol:HDL Ratio",
    shortName: "Chol:HDL",
    category: "lipids",
    unit: "ratio",
    aliases: ["cholesterol_hdl_ratio", "cholesterol:hdl_ratio"],
    description:
      "Ratio of total cholesterol to HDL. Lower ratios are associated with lower cardiovascular risk.",
    referenceRange: { high: 4.5, text: "<4.5" },
    optimalRange: { high: 3.5, text: "<3.5" },
    interpretation: "lower_is_better",
    sortOrder: 160,
    showOnMissionControl: false,
  }),

  // —— Liver ——
  createBiomarker({
    id: "alt",
    displayName: "ALT",
    shortName: "ALT",
    category: "liver",
    unit: "U/L",
    aliases: ["alt"],
    description: "Alanine aminotransferase — liver enzyme; rises with hepatocellular injury.",
    referenceRange: { high: 41, text: "<41" },
    criticalHigh: 200,
    interpretation: "lower_is_better",
    sortOrder: 200,
    showOnMissionControl: false,
    chart: { ...DEFAULT_CHART, preferredDecimals: 0 },
  }),
  createBiomarker({
    id: "ast",
    displayName: "AST",
    shortName: "AST",
    category: "liver",
    unit: "U/L",
    aliases: ["ast"],
    description: "Aspartate aminotransferase — liver and muscle enzyme.",
    referenceRange: { high: 40, text: "<40" },
    criticalHigh: 200,
    interpretation: "lower_is_better",
    sortOrder: 210,
    showOnMissionControl: false,
    chart: { ...DEFAULT_CHART, preferredDecimals: 0 },
  }),
  createBiomarker({
    id: "alp",
    displayName: "ALP",
    shortName: "ALP",
    category: "liver",
    unit: "U/L",
    aliases: ["alp"],
    description: "Alkaline phosphatase — liver and bone enzyme.",
    referenceRange: { low: 30, high: 130, text: "30–130" },
    interpretation: "two_sided",
    sortOrder: 220,
    showOnMissionControl: false,
    chart: { ...DEFAULT_CHART, preferredDecimals: 0 },
  }),
  createBiomarker({
    id: "ggt",
    displayName: "GGT",
    shortName: "GGT",
    category: "liver",
    unit: "U/L",
    aliases: ["ggt"],
    description:
      "Gamma-glutamyl transferase — sensitive to alcohol and biliary stress.",
    referenceRange: { high: 60, text: "<60" },
    criticalHigh: 200,
    interpretation: "lower_is_better",
    sortOrder: 230,
    showOnMissionControl: false,
    chart: { ...DEFAULT_CHART, preferredDecimals: 0 },
  }),
  createBiomarker({
    id: "total_bilirubin",
    displayName: "Total Bilirubin",
    shortName: "Bilirubin",
    category: "liver",
    unit: "umol/L",
    aliases: ["total_bilirubin", "bilirubin"],
    description: "Breakdown product of haem. Elevated in liver or haemolysis disorders.",
    referenceRange: { high: 21, text: "<21" },
    interpretation: "lower_is_better",
    sortOrder: 240,
    showOnMissionControl: false,
    chart: { ...DEFAULT_CHART, preferredDecimals: 0 },
  }),
  createBiomarker({
    id: "albumin",
    displayName: "Albumin",
    shortName: "Albumin",
    category: "liver",
    unit: "g/L",
    aliases: ["albumin"],
    description: "Major plasma protein made by the liver; reflects nutrition and synthetic function.",
    referenceRange: { low: 35, high: 50, text: "35–50" },
    criticalLow: 25,
    interpretation: "two_sided",
    sortOrder: 250,
    showOnMissionControl: false,
    chart: { ...DEFAULT_CHART, preferredDecimals: 0 },
  }),
  createBiomarker({
    id: "globulin",
    displayName: "Globulin",
    shortName: "Globulin",
    category: "liver",
    unit: "g/L",
    aliases: ["globulin"],
    description: "Group of plasma proteins including antibodies and transport proteins.",
    referenceRange: { low: 20, high: 35, text: "20–35" },
    interpretation: "two_sided",
    sortOrder: 260,
    showOnMissionControl: false,
    chart: { ...DEFAULT_CHART, preferredDecimals: 0 },
  }),
  createBiomarker({
    id: "total_protein",
    displayName: "Total Protein",
    shortName: "Protein",
    category: "liver",
    unit: "g/L",
    aliases: ["total_protein"],
    description: "Sum of albumin and globulins in plasma.",
    referenceRange: { low: 60, high: 80, text: "60–80" },
    interpretation: "two_sided",
    sortOrder: 270,
    showOnMissionControl: false,
    chart: { ...DEFAULT_CHART, preferredDecimals: 0 },
  }),

  // —— Kidney ——
  createBiomarker({
    id: "creatinine",
    displayName: "Creatinine",
    shortName: "Creatinine",
    category: "kidney",
    unit: "umol/L",
    aliases: ["creatinine"],
    description:
      "Muscle metabolism waste cleared by the kidneys. Interpreted with eGFR and muscle mass.",
    referenceRange: { low: 59, high: 104, text: "59–104" },
    criticalHigh: 200,
    interpretation: "two_sided",
    sortOrder: 300,
    showOnMissionControl: false,
    chart: { ...DEFAULT_CHART, preferredDecimals: 0 },
  }),
  createBiomarker({
    id: "egfr",
    displayName: "eGFR",
    shortName: "eGFR",
    category: "kidney",
    unit: "mL/min/1.73m²",
    aliases: ["egfr"],
    description:
      "Estimated glomerular filtration rate — key marker of kidney filtration capacity.",
    referenceRange: { low: 60, text: ">60" },
    optimalRange: { low: 90, text: ">90" },
    criticalLow: 30,
    interpretation: "higher_is_better",
    sortOrder: 310,
    showOnMissionControl: false,
    chart: { ...DEFAULT_CHART, preferredDecimals: 0 },
  }),
  createBiomarker({
    id: "urea",
    displayName: "Urea",
    shortName: "Urea",
    category: "kidney",
    unit: "mmol/L",
    aliases: ["urea"],
    description: "Nitrogenous waste from protein metabolism; rises with dehydration or reduced kidney clearance.",
    referenceRange: { low: 2.5, high: 7.8, text: "2.5–7.8" },
    interpretation: "two_sided",
    sortOrder: 320,
    showOnMissionControl: false,
  }),

  // —— Thyroid ——
  createBiomarker({
    id: "tsh",
    displayName: "TSH",
    shortName: "TSH",
    category: "thyroid",
    unit: "mU/L",
    aliases: ["tsh"],
    description:
      "Thyroid-stimulating hormone. Primary screening marker for hypo- and hyperthyroidism.",
    referenceRange: { low: 0.27, high: 4.2, text: "0.27–4.2" },
    optimalRange: { low: 0.5, high: 2.5, text: "0.5–2.5" },
    criticalLow: 0.01,
    criticalHigh: 10,
    interpretation: "two_sided",
    sortOrder: 400,
    showOnMissionControl: false,
    chart: { ...DEFAULT_CHART, preferredDecimals: 2 },
  }),
  createBiomarker({
    id: "free_t4",
    displayName: "Free T4",
    shortName: "Free T4",
    category: "thyroid",
    unit: "pmol/L",
    aliases: ["free_t4"],
    description: "Unbound thyroxine — active thyroid hormone fraction.",
    referenceRange: { low: 12, high: 22, text: "12–22" },
    interpretation: "two_sided",
    sortOrder: 410,
    showOnMissionControl: false,
  }),

  // —— Iron ——
  createBiomarker({
    id: "ferritin",
    displayName: "Ferritin",
    shortName: "Ferritin",
    category: "iron",
    unit: "ug/L",
    aliases: ["ferritin"],
    description:
      "Iron storage protein. Low suggests iron deficiency; very high can reflect inflammation or overload.",
    referenceRange: { low: 30, high: 400, text: "30–400" },
    optimalRange: { low: 50, high: 200, text: "50–200" },
    criticalLow: 15,
    criticalHigh: 1000,
    interpretation: "two_sided",
    sortOrder: 500,
    showOnMissionControl: false,
    chart: { ...DEFAULT_CHART, preferredDecimals: 0 },
  }),

  // —— Full blood count ——
  createBiomarker({
    id: "haemoglobin",
    displayName: "Haemoglobin",
    shortName: "Hb",
    category: "full_blood_count",
    unit: "g/L",
    aliases: ["haemoglobin", "hemoglobin"],
    description: "Oxygen-carrying protein in red cells. Low values indicate anaemia.",
    referenceRange: { low: 130, high: 170, text: "130–170" },
    criticalLow: 80,
    criticalHigh: 200,
    interpretation: "two_sided",
    sortOrder: 600,
    showOnMissionControl: false,
    chart: { ...DEFAULT_CHART, preferredDecimals: 0 },
  }),
  createBiomarker({
    id: "hct",
    displayName: "Haematocrit",
    shortName: "HCT",
    category: "full_blood_count",
    unit: "L/L",
    aliases: ["hct", "haematocrit", "hematocrit"],
    description:
      "Proportion of blood volume occupied by red cells. Closely watched on testosterone therapy.",
    referenceRange: { low: 0.4, high: 0.5, text: "0.40–0.50" },
    criticalHigh: 0.54,
    interpretation: "two_sided",
    sortOrder: 610,
    showOnMissionControl: false,
    chart: { ...DEFAULT_CHART, preferredDecimals: 2 },
  }),
  createBiomarker({
    id: "rbc",
    displayName: "Red Blood Cells",
    shortName: "RBC",
    category: "full_blood_count",
    unit: "×10¹²/L",
    aliases: ["rbc"],
    description: "Red blood cell count.",
    referenceRange: { low: 4.5, high: 5.5, text: "4.5–5.5" },
    interpretation: "two_sided",
    sortOrder: 620,
    showOnMissionControl: false,
  }),
  createBiomarker({
    id: "mcv",
    displayName: "MCV",
    shortName: "MCV",
    category: "full_blood_count",
    unit: "fL",
    aliases: ["mcv"],
    description: "Mean corpuscular volume — average red cell size.",
    referenceRange: { low: 83, high: 101, text: "83–101" },
    interpretation: "two_sided",
    sortOrder: 630,
    showOnMissionControl: false,
    chart: { ...DEFAULT_CHART, preferredDecimals: 0 },
  }),
  createBiomarker({
    id: "mch",
    displayName: "MCH",
    shortName: "MCH",
    category: "full_blood_count",
    unit: "pg",
    aliases: ["mch"],
    description: "Mean corpuscular haemoglobin — average Hb per red cell.",
    referenceRange: { low: 27, high: 32, text: "27–32" },
    interpretation: "two_sided",
    sortOrder: 640,
    showOnMissionControl: false,
  }),
  createBiomarker({
    id: "mchc",
    displayName: "MCHC",
    shortName: "MCHC",
    category: "full_blood_count",
    unit: "g/L",
    aliases: ["mchc"],
    description: "Mean corpuscular haemoglobin concentration.",
    referenceRange: { low: 315, high: 345, text: "315–345" },
    interpretation: "two_sided",
    sortOrder: 650,
    showOnMissionControl: false,
    chart: { ...DEFAULT_CHART, preferredDecimals: 0 },
  }),
  createBiomarker({
    id: "platelets",
    displayName: "Platelets",
    shortName: "Platelets",
    category: "full_blood_count",
    unit: "×10⁹/L",
    aliases: ["platelets"],
    description: "Cell fragments that enable clotting.",
    referenceRange: { low: 150, high: 400, text: "150–400" },
    criticalLow: 50,
    criticalHigh: 1000,
    interpretation: "two_sided",
    sortOrder: 660,
    showOnMissionControl: false,
    chart: { ...DEFAULT_CHART, preferredDecimals: 0 },
  }),
  createBiomarker({
    id: "wcc",
    displayName: "White Blood Cells",
    shortName: "WCC",
    category: "full_blood_count",
    unit: "×10⁹/L",
    aliases: ["wcc", "wbc"],
    description: "Total white cell count — rises with infection or inflammation.",
    referenceRange: { low: 3.6, high: 10.5, text: "3.6–10.5" },
    criticalLow: 2,
    criticalHigh: 20,
    interpretation: "two_sided",
    sortOrder: 670,
    showOnMissionControl: false,
  }),

  // —— White blood cells (differential) ——
  createBiomarker({
    id: "neutrophils",
    displayName: "Neutrophils",
    shortName: "Neutrophils",
    category: "white_blood_cells",
    unit: "×10⁹/L",
    aliases: ["neutrophils"],
    description: "Primary bacterial defence white cells.",
    referenceRange: { low: 1.8, high: 7.5, text: "1.8–7.5" },
    interpretation: "two_sided",
    sortOrder: 700,
    showOnMissionControl: false,
  }),
  createBiomarker({
    id: "lymphocytes",
    displayName: "Lymphocytes",
    shortName: "Lymphocytes",
    category: "white_blood_cells",
    unit: "×10⁹/L",
    aliases: ["lymphocytes"],
    description: "Adaptive immune white cells (T and B cells).",
    referenceRange: { low: 1.0, high: 4.0, text: "1.0–4.0" },
    interpretation: "two_sided",
    sortOrder: 710,
    showOnMissionControl: false,
  }),
  createBiomarker({
    id: "monocytes",
    displayName: "Monocytes",
    shortName: "Monocytes",
    category: "white_blood_cells",
    unit: "×10⁹/L",
    aliases: ["monocytes"],
    description: "Phagocytic white cells involved in chronic inflammation response.",
    referenceRange: { low: 0.2, high: 0.8, text: "0.2–0.8" },
    interpretation: "two_sided",
    sortOrder: 720,
    showOnMissionControl: false,
  }),
  createBiomarker({
    id: "eosinophils",
    displayName: "Eosinophils",
    shortName: "Eosinophils",
    category: "white_blood_cells",
    unit: "×10⁹/L",
    aliases: ["eosinophils"],
    description: "White cells involved in allergy and parasitic response.",
    referenceRange: { low: 0, high: 0.4, text: "0.0–0.4" },
    interpretation: "two_sided",
    sortOrder: 730,
    showOnMissionControl: false,
  }),
  createBiomarker({
    id: "basophils",
    displayName: "Basophils",
    shortName: "Basophils",
    category: "white_blood_cells",
    unit: "×10⁹/L",
    aliases: ["basophils"],
    description: "Rare white cells involved in allergic inflammation.",
    referenceRange: { low: 0, high: 0.1, text: "0.0–0.1" },
    interpretation: "two_sided",
    sortOrder: 740,
    showOnMissionControl: false,
  }),
]

const byId = new Map(BIOMARKER_REGISTRY.map((b) => [b.id, b]))
const byAlias = (() => {
  const map = new Map<string, BiomarkerDefinition>()
  for (const biomarker of BIOMARKER_REGISTRY) {
    map.set(biomarker.id, biomarker)
    for (const alias of biomarker.aliases) {
      map.set(alias, biomarker)
    }
  }
  return map
})()

export function getBiomarkerDefinition(
  idOrAlias: string
): BiomarkerDefinition | undefined {
  return byAlias.get(idOrAlias) ?? byId.get(idOrAlias)
}

export function missionControlBiomarkers(): BiomarkerDefinition[] {
  return BIOMARKER_REGISTRY.filter((b) => b.showOnMissionControl).sort(
    (a, b) => a.sortOrder - b.sortOrder
  )
}

export function biomarkersByCategory(): Array<{
  category: BiomarkerCategory
  label: string
  biomarkers: BiomarkerDefinition[]
}> {
  const order: BiomarkerCategory[] = [
    "hormones",
    "diabetes",
    "lipids",
    "liver",
    "kidney",
    "thyroid",
    "iron",
    "full_blood_count",
    "white_blood_cells",
    "other",
  ]
  return order
    .map((category) => ({
      category,
      label: BIOMARKER_CATEGORY_LABELS[category],
      biomarkers: BIOMARKER_REGISTRY.filter((b) => b.category === category).sort(
        (a, b) => a.sortOrder - b.sortOrder
      ),
    }))
    .filter((group) => group.biomarkers.length > 0)
}

/** Resolve status via the biomarker's own evaluateStatus(). */
export function resolveBiomarkerStatus(
  idOrAlias: string,
  value: number,
  context?: BiomarkerEvaluationContext
): ResolvedBiomarkerStatus {
  const def = getBiomarkerDefinition(idOrAlias)
  if (!def) {
    return statusResult("unknown")
  }
  return def.evaluateStatus(value, context)
}

export function formatBiomarkerValue(
  idOrAlias: string,
  value: number
): string {
  const def = getBiomarkerDefinition(idOrAlias)
  const decimals = def?.chart.preferredDecimals ?? 1
  const formatted =
    decimals === 0
      ? Math.round(value).toString()
      : value.toFixed(decimals).replace(/\.?0+$/, "")
  const unit = def?.unit
  return unit ? `${formatted} ${unit}` : formatted
}

export function formatBiomarkerDelta(
  delta: number,
  unit: string
): { direction: "up" | "down" | "neutral"; display: string } {
  if (delta === 0) {
    return { direction: "neutral", display: "Unchanged vs previous" }
  }

  const abs = Math.abs(delta)
  const formatted =
    Number.isInteger(abs) || abs >= 10
      ? abs.toFixed(0)
      : abs >= 1
        ? abs.toFixed(1)
        : abs.toFixed(2)
  const arrow = delta > 0 ? "↑" : "↓"
  const unitSuffix = unit ? ` ${unit}` : ""

  return {
    direction: delta > 0 ? "up" : "down",
    display: `${arrow} ${formatted}${unitSuffix} over previous result`,
  }
}

/** Chart shading bands from registry reference / optimal ranges. */
export function getBiomarkerChartBands(idOrAlias: string): {
  reference?: NumericRange
  optimal?: NumericRange
  color: string
} {
  const def = getBiomarkerDefinition(idOrAlias)
  if (!def) return { color: "var(--primary)" }
  return {
    reference: def.referenceRange,
    optimal: def.optimalRange,
    color: def.chart.color,
  }
}
