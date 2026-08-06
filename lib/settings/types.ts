/**
 * Settings preference model — registry-driven, multi-user ready.
 * Primary account-centre categories are listed first.
 */

export type SettingsCategoryId =
  | "profile"
  | "appearance"
  | "preferences"
  | "health_sources"
  | "cloud"
  | "notifications"
  | "privacy"
  | "health_profile"
  | "goals"
  | "treatments"
  | "ai_coach"
  | "advanced"
  | "about"
  /** Legacy aliases kept for registry compatibility */
  | "general"
  | "data_sources"
  | "integrations"

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
  section: string
  label: string
  description?: string
  control: PreferenceControl
  keywords: string[]
  defaultValue: PreferenceValue
  options?: Array<{ value: string; label: string }>
  unit?: string
  min?: number
  max?: number
  step?: number
  scope: "user" | "workspace"
  kind?: "preference" | "action" | "computed"
  actionId?: string
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
