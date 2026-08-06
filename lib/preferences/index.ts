export { preferencesFromRegistration } from "./defaults"
export { getPreferencesStore } from "./preferences-store"
export {
  ensureUserPreferences,
  fetchUserPreferences,
  patchUserPreferences,
  upsertUserPreferences,
} from "./repository"
export {
  defaultUserPreferences,
  type DashboardLayout,
  type Density,
  type FontScaling,
  type ThemePreference,
  type UnitsSystem,
  type UserPreferences,
  type UserPreferencesPatch,
  type WeekStart,
} from "./types"
