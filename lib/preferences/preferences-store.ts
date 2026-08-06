"use client"

import {
  defaultUserPreferences,
  type UserPreferences,
  type UserPreferencesPatch,
} from "./types"

const STORAGE_KEY = "geoffit.user-preferences.v1"

type Listener = () => void

class PreferencesStore {
  private prefs: UserPreferences | null = null
  private listeners = new Set<Listener>()
  private userId: string | null = null

  subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit() {
    this.listeners.forEach((l) => l())
  }

  getSnapshot = () => this.prefs

  getServerSnapshot = () => null

  hydrateLocal(userId: string) {
    this.userId = userId
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(`${STORAGE_KEY}:${userId}`)
      if (raw) {
        this.prefs = { ...defaultUserPreferences(userId), ...JSON.parse(raw) }
      } else {
        this.prefs = defaultUserPreferences(userId)
      }
    } catch {
      this.prefs = defaultUserPreferences(userId)
    }
    this.emit()
  }

  setRemote(prefs: UserPreferences) {
    this.userId = prefs.user_id
    this.prefs = prefs
    this.persist()
    this.emit()
  }

  patchLocal(patch: UserPreferencesPatch) {
    if (!this.userId) return
    const base = this.prefs ?? defaultUserPreferences(this.userId)
    this.prefs = {
      ...base,
      ...patch,
      updated_at: new Date().toISOString(),
    }
    this.persist()
    this.emit()
  }

  completeOnboarding() {
    this.patchLocal({ show_welcome_screen: false })
  }

  private persist() {
    if (typeof window === "undefined" || !this.userId || !this.prefs) return
    window.localStorage.setItem(
      `${STORAGE_KEY}:${this.userId}`,
      JSON.stringify(this.prefs)
    )
  }
}

let singleton: PreferencesStore | null = null

export function getPreferencesStore() {
  if (!singleton) singleton = new PreferencesStore()
  return singleton
}
