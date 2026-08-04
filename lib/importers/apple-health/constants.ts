/** Apple HealthKit type identifiers we extract on first pass. */
export const APPLE_HEALTH_RECORD_TYPES = {
  BODY_MASS: "HKQuantityTypeIdentifierBodyMass",
  BODY_FAT_PERCENTAGE: "HKQuantityTypeIdentifierBodyFatPercentage",
  LEAN_BODY_MASS: "HKQuantityTypeIdentifierLeanBodyMass",
  BODY_MASS_INDEX: "HKQuantityTypeIdentifierBodyMassIndex",
  WAIST_CIRCUMFERENCE: "HKQuantityTypeIdentifierWaistCircumference",
  HEIGHT: "HKQuantityTypeIdentifierHeight",
  SLEEP_ANALYSIS: "HKCategoryTypeIdentifierSleepAnalysis",
  HEART_RATE: "HKQuantityTypeIdentifierHeartRate",
  RESTING_HEART_RATE: "HKQuantityTypeIdentifierRestingHeartRate",
  HRV_SDNN: "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
  VO2_MAX: "HKQuantityTypeIdentifierVO2Max",
  DIETARY_ENERGY: "HKQuantityTypeIdentifierDietaryEnergyConsumed",
  DIETARY_PROTEIN: "HKQuantityTypeIdentifierDietaryProtein",
  DIETARY_CARBOHYDRATES: "HKQuantityTypeIdentifierDietaryCarbohydrates",
  DIETARY_FAT: "HKQuantityTypeIdentifierDietaryFatTotal",
  DIETARY_FIBRE: "HKQuantityTypeIdentifierDietaryFiber",
  DIETARY_SUGAR: "HKQuantityTypeIdentifierDietarySugar",
  DIETARY_WATER: "HKQuantityTypeIdentifierDietaryWater",
  DIETARY_SODIUM: "HKQuantityTypeIdentifierDietarySodium",
  DIETARY_ALCOHOL: "HKQuantityTypeIdentifierNumberOfAlcoholicBeverages",
  DIETARY_CAFFEINE: "HKQuantityTypeIdentifierDietaryCaffeine",
  STEP_COUNT: "HKQuantityTypeIdentifierStepCount",
} as const

export const SUPPORTED_APPLE_HEALTH_RECORD_TYPES = new Set<string>(
  Object.values(APPLE_HEALTH_RECORD_TYPES)
)

/** Synthetic type key used for <Workout> elements in diagnostics. */
export const APPLE_HEALTH_WORKOUT_TYPE = "HKWorkoutTypeIdentifier"

export const APPLE_HEALTH_XML_NAMES = ["export.xml", "apple_health_export.xml"] as const

const HEALTHKIT_PREFIXES = [
  "HKQuantityTypeIdentifier",
  "HKCategoryTypeIdentifier",
  "HKCorrelationTypeIdentifier",
  "HKCharacteristicTypeIdentifier",
  "HKDataTypeIdentifier",
  "HKWorkout",
] as const

export function isHealthKitTypeIdentifier(type: string): boolean {
  return HEALTHKIT_PREFIXES.some((prefix) => type.startsWith(prefix))
}

/** Human-readable label from a HealthKit type identifier. */
export function friendlyHealthKitTypeName(type: string): string {
  if (type === APPLE_HEALTH_WORKOUT_TYPE) return "Workout"

  const stripped = type
    .replace(/^HKQuantityTypeIdentifier/, "")
    .replace(/^HKCategoryTypeIdentifier/, "")
    .replace(/^HKCorrelationTypeIdentifier/, "")
    .replace(/^HKCharacteristicTypeIdentifier/, "")
    .replace(/^HKDataTypeIdentifier/, "")
    .replace(/^HKWorkoutActivityType/, "")
    .replace(/^HKWorkoutTypeIdentifier/, "Workout")

  return stripped.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
}

export type HealthKitTypeClassification =
  | "supported"
  | "disabled"
  | "ignored"
  | "unknown"

export function classifyHealthKitType(
  type: string,
  enabledHkTypes?: Set<string>,
  profileKnownHkTypes?: Set<string>
): HealthKitTypeClassification {
  const enabled =
    enabledHkTypes ??
    new Set([
      ...SUPPORTED_APPLE_HEALTH_RECORD_TYPES,
      APPLE_HEALTH_WORKOUT_TYPE,
    ])

  if (enabled.has(type)) return "supported"

  if (
    profileKnownHkTypes?.has(type) ||
    SUPPORTED_APPLE_HEALTH_RECORD_TYPES.has(type) ||
    type === APPLE_HEALTH_WORKOUT_TYPE
  ) {
    return "disabled"
  }

  if (isHealthKitTypeIdentifier(type)) return "ignored"

  return "unknown"
}
