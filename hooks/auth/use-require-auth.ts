"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

import { useAuthContext } from "@/components/auth/auth-provider"

/**
 * Client-side guard for interactive surfaces. Middleware is the primary gate;
 * this catches stale client navigations after sign-out.
 */
export function useRequireAuth(enabled = true) {
  const { user, loading, configured } = useAuthContext()
  const router = useRouter()
  const pathname = usePathname()

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
    loading: loading || (configured && !user),
    authenticated: Boolean(user),
  }
}
