"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react"

import { useTheme } from "@/components/theme/theme-provider"
import { useUser } from "@/hooks/auth"
import { scheduleCloudBootstrap } from "@/lib/health/bootstrap"
import {
  ensureUserPreferences,
  getPreferencesStore,
  patchUserPreferences,
  type UserPreferences,
  type UserPreferencesPatch,
} from "@/lib/preferences"
import { createClientOrNull } from "@/lib/supabase/client"

type PreferencesContextValue = {
  preferences: UserPreferences | null
  loading: boolean
  updatePreferences: (patch: UserPreferencesPatch) => Promise<void>
  completeOnboarding: () => Promise<void>
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading: authLoading } = useUser()
  const { setTheme } = useTheme()
  const store = getPreferencesStore()
  const preferences = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  )

  useEffect(() => {
    if (!user) return
    store.hydrateLocal(user.id)
    const supabase = createClientOrNull()
    if (!supabase) return
    void ensureUserPreferences(supabase, user.id)
      .then((row) => {
        store.setRemote(row)
        setTheme(row.theme)
      })
      .catch(() => {
        // Table may not exist yet — local defaults remain.
      })

    // Temporary multi-device bridge (async, non-blocking).
    // Remove when cloud-first hydration lands — see lib/health/bootstrap.
    scheduleCloudBootstrap(user.id, supabase)
  }, [user, store, setTheme])

  const updatePreferences = useCallback(
    async (patch: UserPreferencesPatch) => {
      if (!user) return
      store.patchLocal(patch)
      if (patch.theme) setTheme(patch.theme)
      const supabase = createClientOrNull()
      if (!supabase) return
      try {
        const next = await patchUserPreferences(supabase, user.id, patch)
        store.setRemote(next)
      } catch {
        // Keep local optimistic state.
      }
    },
    [user, store, setTheme]
  )

  const completeOnboarding = useCallback(async () => {
    await updatePreferences({ show_welcome_screen: false })
  }, [updatePreferences])

  const value = useMemo(
    () => ({
      preferences,
      loading: authLoading || (Boolean(user) && !preferences),
      updatePreferences,
      completeOnboarding,
    }),
    [preferences, authLoading, user, updatePreferences, completeOnboarding]
  )

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext)
  if (!ctx) {
    throw new Error("usePreferences must be used within PreferencesProvider")
  }
  return ctx
}
