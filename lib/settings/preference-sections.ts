import type { SettingsCategory, SettingsCategoryId } from "./types"

/** Primary account-centre navigation */
export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: "profile",
    label: "Profile",
    description: "Avatar, name, email, timezone, and language.",
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Theme, accent colour, density, and type scale.",
  },
  {
    id: "preferences",
    label: "Preferences",
    description: "Units, dates, dashboard layout, and landing page.",
  },
  {
    id: "health_sources",
    label: "Health Sources",
    description: "Connections that feed your health operating system.",
  },
  {
    id: "cloud",
    label: "Cloud",
    description: "Supabase status, offline cache, and migration readiness.",
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Push, email, and reminder categories.",
  },
  {
    id: "privacy",
    label: "Privacy & Security",
    description: "Password, sessions, export, and account controls.",
  },
  {
    id: "health_profile",
    label: "Health Profile",
    description: "Clinical context that shapes coaching and risk.",
  },
  {
    id: "goals",
    label: "Goals",
    description: "Targets used across Progress, Nutrition, and Coach.",
  },
  {
    id: "ai_coach",
    label: "AI Coach",
    description: "Memory, style, and proactive coaching.",
  },
  {
    id: "advanced",
    label: "Advanced",
    description: "Diagnostics and maintenance.",
  },
  {
    id: "about",
    label: "About",
    description: "Version, licences, and release notes.",
  },
]

export function getCategory(
  id: SettingsCategoryId
): SettingsCategory | undefined {
  return SETTINGS_CATEGORIES.find((category) => category.id === id)
}
