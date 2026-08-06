"use client"

import { useAuthContext } from "@/components/auth/auth-provider"
import { greetingName } from "@/lib/auth"

export function useProfile() {
  const { profile, loading, refreshProfile, setProfile, user } = useAuthContext()
  return {
    profile,
    loading,
    refreshProfile,
    setProfile,
    greetingName: greetingName(profile),
    userId: user?.id ?? profile?.id ?? null,
  }
}
