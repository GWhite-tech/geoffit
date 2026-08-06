import {
  defaultUserPreferences,
  type ThemePreference,
  type UnitsSystem,
  type UserPreferences,
} from "./types"

export function preferencesFromRegistration(input: {
  userId: string
  theme: ThemePreference
  units: UnitsSystem
  timezone?: string
}): UserPreferences {
  return defaultUserPreferences(input.userId, {
    theme: input.theme,
    units: input.units,
    timezone: input.timezone,
    show_welcome_screen: true,
  })
}
