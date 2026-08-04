import { PREFERENCE_REGISTRY } from "./preference-registry"
import { getCategory } from "./preference-sections"
import type { SettingsSearchHit } from "./types"

/**
 * PreferenceSearchEngine — instant filter across every registered setting.
 */
export function searchPreferences(query: string): SettingsSearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const tokens = q.split(/\s+/).filter(Boolean)
  const hits: SettingsSearchHit[] = []

  for (const preference of PREFERENCE_REGISTRY) {
    const haystack = [
      preference.label,
      preference.description ?? "",
      preference.section,
      preference.id,
      ...preference.keywords,
      getCategory(preference.category)?.label ?? "",
    ]
      .join(" ")
      .toLowerCase()

    let score = 0
    for (const token of tokens) {
      if (preference.label.toLowerCase().includes(token)) score += 8
      if (preference.keywords.some((keyword) => keyword.includes(token))) {
        score += 5
      }
      if (haystack.includes(token)) score += 2
    }

    if (score > 0) {
      hits.push({
        preference,
        categoryLabel: getCategory(preference.category)?.label ?? preference.category,
        score,
      })
    }
  }

  return hits.sort((a, b) => b.score - a.score || a.preference.label.localeCompare(b.preference.label))
}
