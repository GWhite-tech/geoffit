import type { HealthRecord } from "@/lib/domain/health"
import { calculateRecovery } from "@/lib/health/recovery"
import {
  averageSleepMinutes,
  latestWeight,
  workoutHistory,
} from "@/lib/health/selectors"
import {
  latestBodyComposition,
} from "@/lib/health/body-composition"
import { formatDurationMinutes } from "@/lib/health/types"

export type HealthContextCard = {
  id: string
  label: string
  value: string
  available: boolean
}

/**
 * Compact health context cards for the Blood Markers right rail.
 */
export function buildBloodHealthContext(
  records: HealthRecord[]
): HealthContextCard[] {
  const weight = latestWeight(records)
  const body = latestBodyComposition(records)
  const recovery = calculateRecovery(records)
  const sleepMins = averageSleepMinutes(records, 7)
  const workouts30 = workoutHistory(records).filter((w) => {
    const t = Date.parse(w.startDate)
    if (Number.isNaN(t)) return false
    return Date.now() - t <= 30 * 86_400_000
  })

  const bmi = body?.bodyMassIndex
  const waist = body?.waistCircumference
  const bodyFat = body?.bodyFatPercentage
  const visceralAvailable = false

  return [
    {
      id: "weight",
      label: "Latest weight",
      value: weight ? `${weight.value.toFixed(1)} ${weight.unit}` : "—",
      available: Boolean(weight),
    },
    {
      id: "bmi",
      label: "Latest BMI",
      value: bmi != null ? bmi.toFixed(1) : "—",
      available: bmi != null,
    },
    {
      id: "waist",
      label: "Waist",
      value: waist != null ? `${waist.toFixed(0)} cm` : "—",
      available: waist != null,
    },
    {
      id: "body_fat",
      label: "Body Fat",
      value: bodyFat != null ? `${bodyFat.toFixed(1)}%` : "—",
      available: bodyFat != null,
    },
    {
      id: "visceral_fat",
      label: "Visceral Fat",
      value: "—",
      available: visceralAvailable,
    },
    {
      id: "exercise",
      label: "Exercise frequency",
      value:
        workouts30.length > 0
          ? `${workouts30.length} sessions · 30d`
          : "—",
      available: workouts30.length > 0,
    },
    {
      id: "sleep",
      label: "Average sleep",
      value: sleepMins != null ? formatDurationMinutes(sleepMins) : "—",
      available: sleepMins != null,
    },
    {
      id: "recovery",
      label: "Recovery",
      value: recovery.score != null ? `${recovery.score}%` : "—",
      available: recovery.score != null,
    },
  ]
}
