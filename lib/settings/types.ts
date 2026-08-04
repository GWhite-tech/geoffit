/**
 * Settings preference model — registry-driven, multi-user ready.
 */

export type SettingsCategoryId =
  | "general"
  | "profile"
  | "health_profile"
  | "goals"
  | "data_sources"
  | "integrations"
  | "treatments"
  | "notifications"
  | "privacy"
  | "ai_coach"
  | "appearance"
  | "advanced"
  | "about"

export type PreferenceControl =
  | "text"
  | "email"
  | "number"
  | "date"
  | "select"
  | "toggle"
  | "textarea"
  | "action"
  | "readonly"

export type PreferenceValue = string | number | boolean | null

export type PreferenceDefinition = {
  id: string
  category: SettingsCategoryId
  /** Section heading within the category panel */
  section: string
  label: string
  description?: string
  control: PreferenceControl
  /** Search keywords beyond label/description */
  keywords: string[]
  defaultValue: PreferenceValue
  options?: Array<{ value: string; label: string }>
  unit?: string
  min?: number
  max?: number
  step?: number
  /** Future: user | family | coach | enterprise scopes */
  scope: "user" | "workspace"
  /** Special handling — not a simple persisted field */
  kind?: "preference" | "action" | "computed"
  actionId?: string
  /** Availability for future features */
  availability?: "available" | "coming_soon"
}

export type SettingsCategory = {
  id: SettingsCategoryId
  label: string
  description: string
}

export type DataSourceStatus = {
  id: string
  name: string
  status: "connected" | "manual" | "available" | "coming_soon"
  detail: string | null
  lastActivity: string | null
  lastActivityLabel: string | null
  actions: Array<"connect" | "disconnect" | "reimport" | "sync" | "history">
}

export type StoreStatistics = {
  healthRecords: number
  nutritionDays: number
  bloodTests: number
  bloodMarkers: number
  treatments: number
  doseEvents: number
  conversations: number
}

export type SettingsSearchHit = {
  preference: PreferenceDefinition
  categoryLabel: string
  score: number
}
