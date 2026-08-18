"use client"

import { useAuthContext } from "@/components/auth/auth-provider"
import { resolveShellDisplayName } from "@/lib/auth/startup-shell"

export function useProfile() {
  const { profile, loading, refreshProfile, setProfile, user } = useAuthContext()
  return {
    profile,
    loading,
    refreshProfile,
    setProfile,
    greetingName: resolveShellDisplayName(profile, user),
    userId: user?.id ?? profile?.id ?? null,
  }
}
