export type ThemePreference = "light" | "dark" | "system"
export type UnitsSystem = "metric" | "imperial"
export type WeekStart = "monday" | "sunday"
export type DashboardLayout = "classic" | "compact" | "focus"
export type FontScaling = "default" | "large" | "xl"
export type Density = "comfortable" | "compact"
export type WeightUnit = "kg" | "lb"
export type DistanceUnit = "km" | "mi"
export type EnergyUnit = "kcal" | "kj"
export type TemperatureUnit = "c" | "f"
export type BloodGlucoseUnit = "mmol_l" | "mg_dl"

/**
 * Presentation / UX preferences — one row per user.
 * Notifications, privacy, AI, and source-priority prefs live in dedicated tables.
 */
export type UserPreferences = {
  id: string
  user_id: string
  theme: ThemePreference
  accent_colour: string
  units: UnitsSystem
  timezone: string
  locale: string
  date_format: string
  week_start: WeekStart
  default_dashboard: string
  dashboard_layout: DashboardLayout
  sidebar_collapsed: boolean
  show_welcome_screen: boolean
  preferred_weight_unit: WeightUnit
  preferred_distance_unit: DistanceUnit
  preferred_energy_unit: EnergyUnit
  preferred_temperature_unit: TemperatureUnit
  preferred_blood_glucose_unit: BloodGlucoseUnit
  font_scaling: FontScaling
  density: Density
  created_at: string
  updated_at: string
}

export type UserPreferencesPatch = Partial<
  Omit<UserPreferences, "id" | "user_id" | "created_at" | "updated_at">
>

export function defaultUserPreferences(
  userId: string,
  seed?: Partial<UserPreferences>
): UserPreferences {
  const units = seed?.units ?? "metric"
  const now = new Date().toISOString()
  return {
    id: userId,
    user_id: userId,
    theme: seed?.theme ?? "system",
    accent_colour: seed?.accent_colour ?? "#0F766E",
    units,
    timezone:
      seed?.timezone ??
      (typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC"),
    locale: seed?.locale ?? "en-GB",
    date_format: seed?.date_format ?? "dd MMM yyyy",
    week_start: seed?.week_start ?? "monday",
    default_dashboard: seed?.default_dashboard ?? "mission-control",
    dashboard_layout: seed?.dashboard_layout ?? "classic",
    sidebar_collapsed: seed?.sidebar_collapsed ?? false,
    show_welcome_screen: seed?.show_welcome_screen ?? true,
    preferred_weight_unit:
      seed?.preferred_weight_unit ?? (units === "imperial" ? "lb" : "kg"),
    preferred_distance_unit:
      seed?.preferred_distance_unit ?? (units === "imperial" ? "mi" : "km"),
    preferred_energy_unit: seed?.preferred_energy_unit ?? "kcal",
    preferred_temperature_unit:
      seed?.preferred_temperature_unit ?? (units === "imperial" ? "f" : "c"),
    preferred_blood_glucose_unit:
      seed?.preferred_blood_glucose_unit ?? "mmol_l",
    font_scaling: seed?.font_scaling ?? "default",
    density: seed?.density ?? "comfortable",
    created_at: seed?.created_at ?? now,
    updated_at: seed?.updated_at ?? now,
  }
}
