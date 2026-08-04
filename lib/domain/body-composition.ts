/**
 * Geoffit body composition domain — weighing-session level model.
 * Individual HealthKit quantities map into HealthRecords, then merge here.
 */

export interface BodyCompositionMeasurement {
  id: string
  /** Session timestamp (ISO). */
  date: string
  weight?: number
  /** Body fat as percentage points (e.g. 24.5 for 24.5%). */
  bodyFatPercentage?: number
  bodyFatMass?: number
  leanBodyMass?: number
  bodyMassIndex?: number
  waistCircumference?: number
  height?: number
  /** Units for each numeric field when present. */
  units: {
    weight?: string
    bodyFatPercentage?: string
    bodyFatMass?: string
    leanBodyMass?: string
    bodyMassIndex?: string
    waistCircumference?: string
    height?: string
  }
  source: string
  sourceName?: string
  fingerprint: string
}

export const BODY_COMPOSITION_SESSION_WINDOW_MS = 5 * 60 * 1000
