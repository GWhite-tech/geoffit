"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

import { useAuthContext } from "@/components/auth/auth-provider"
import {
  resolveAuthShellPhase,
  type AuthShellPhase,
} from "@/lib/auth/startup-shell"

/**
 * Client-side guard for interactive surfaces. Middleware is the primary gate;
 * this catches stale client navigations after sign-out.
 *
 * `loading` is session-pending only — profile fetch must not hold the shell.
 */
export function useRequireAuth(enabled = true): {
  user: ReturnType<typeof useAuthContext>["user"]
  loading: boolean
  authenticated: boolean
  phase: AuthShellPhase
} {
  const { user, loading, configured } = useAuthContext()
  const router = useRouter()
  const pathname = usePathname()

  const phase = resolveAuthShellPhase({
    configured: enabled ? configured : false,
    sessionPending: enabled && configured && loading,
    user: enabled && configured ? user : null,
  })

  useEffect(() => {
    if (!enabled || loading) return
    if (!configured) return
    if (!user) {
      const next = encodeURIComponent(pathname || "/")
      router.replace(`/login?next=${next}`)
    }
  }, [enabled, loading, configured, user, router, pathname])

  return {
    user,
    loading: phase === "session_pending",
    authenticated: phase === "authenticated",
    phase,
  }
}
