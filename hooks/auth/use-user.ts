"use client"

import { useAuthContext } from "@/components/auth/auth-provider"

export function useUser() {
  const { user, session, loading, configured } = useAuthContext()
  return { user, session, loading, configured }
}
