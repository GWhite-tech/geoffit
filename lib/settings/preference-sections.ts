import type { SettingsCategory, SettingsCategoryId } from "./types"

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: "general",
    label: "General",
    description: "Language, region, and measurement defaults.",
  },
  {
    id: "profile",
    label: "Profile",
    description: "Who you are in Geoffit.",
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
    id: "data_sources",
    label: "Data Sources",
    description: "Everything feeding your health operating system.",
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "Future connectors and services.",
  },
  {
    id: "treatments",
    label: "Treatments",
    description: "Defaults for prescriptions, peptides, and inventory.",
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "What Geoffit may surface, and how.",
  },
  {
    id: "privacy",
    label: "Privacy & Security",
    description: "Access, export, and account controls.",
  },
  {
    id: "ai_coach",
    label: "AI Coach",
    description: "Memory, style, and proactive coaching.",
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Theme, density, and motion.",
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
