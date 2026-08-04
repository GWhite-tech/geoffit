import { getNutritionStore } from "@/lib/health/nutrition/nutrition-store"

import { defaultPreferenceValues } from "./preference-registry"
import type { PreferenceValue, SettingsCategoryId } from "./types"

const STORAGE_KEY = "geoffit.settings-store.v1"

type Listener = () => void

type PersistedShape = {
  version: number
  /** Future multi-user: scoped preference bags */
  userId: string
  activeCategory: SettingsCategoryId
  values: Record<string, PreferenceValue>
  updatedAt: string
}

/**
 * SettingsStore — persisted per-user preferences.
 * Values are keyed by PreferenceRegistry ids.
 */
export class SettingsStore {
  private userId = "local"
  private values: Record<string, PreferenceValue> = defaultPreferenceValues()
  private activeCategory: SettingsCategoryId = "general"
  private listeners = new Set<Listener>()
  private hydrated = false

  getUserId(): string {
    return this.userId
  }

  getActiveCategory(): SettingsCategoryId {
    return this.activeCategory
  }

  setActiveCategory(category: SettingsCategoryId): void {
    if (this.activeCategory === category) return
    this.activeCategory = category
    this.persist()
    this.emit()
  }

  getValue(id: string): PreferenceValue {
    if (id in this.values) return this.values[id]!
    return defaultPreferenceValues()[id] ?? null
  }

  getValues(): Record<string, PreferenceValue> {
    return { ...this.values }
  }

  setValue(id: string, value: PreferenceValue): void {
    this.values = { ...this.values, [id]: value }
    this.syncLinkedStores(id, value)
    this.persist()
    this.emit()
  }

  resetValue(id: string): void {
    const defaults = defaultPreferenceValues()
    if (id in defaults) {
      this.setValue(id, defaults[id]!)
    }
  }

  getVersion(): number {
    return (
      Object.keys(this.values).length * 10 +
      this.activeCategory.length +
      this.userId.length
    )
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  hydrateFromStorage(): void {
    if (typeof window === "undefined" || this.hydrated) return
    this.hydrated = true
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedShape
        this.userId = parsed.userId || "local"
        this.values = {
          ...defaultPreferenceValues(),
          ...(parsed.values ?? {}),
        }
        if (parsed.activeCategory) {
          this.activeCategory = parsed.activeCategory
        }
      } else {
        // Seed goals from nutrition targets when present.
        const targets = getNutritionStore().getTargets()
        this.values = {
          ...defaultPreferenceValues(),
          "goals.protein": targets.protein,
          "goals.calories": targets.calories,
          "goals.water": targets.water,
        }
      }
    } catch {
      this.values = defaultPreferenceValues()
    }
    this.emit()
  }

  private syncLinkedStores(id: string, value: PreferenceValue): void {
    if (typeof value !== "number" || !Number.isFinite(value)) return
    const nutrition = getNutritionStore()
    const targets = nutrition.getTargets()
    if (id === "goals.protein") {
      nutrition.setTargets({ ...targets, protein: value })
    } else if (id === "goals.calories") {
      nutrition.setTargets({ ...targets, calories: value })
    } else if (id === "goals.water") {
      nutrition.setTargets({ ...targets, water: value })
    }
  }

  private persist(): void {
    if (typeof window === "undefined") return
    try {
      const payload: PersistedShape = {
        version: 1,
        userId: this.userId,
        activeCategory: this.activeCategory,
        values: this.values,
        updatedAt: new Date().toISOString(),
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // ignore
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

let singleton: SettingsStore | null = null

export function getSettingsStore(): SettingsStore {
  if (!singleton) singleton = new SettingsStore()
  return singleton
}

export function resetSettingsStore(): void {
  singleton = null
}
