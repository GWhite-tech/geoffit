"use client"

import { useAuthContext } from "@/components/auth/auth-provider"
import { AppShell } from "@/components/layout/app-shell"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"
import { useRequireAuth } from "@/hooks/auth"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { configured } = useAuthContext()
  const { loading, authenticated } = useRequireAuth(configured)

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <p className="text-[14px] text-muted-foreground">Loading Geoffit…</p>
      </div>
    )
  }

  // Local-first fallback when Supabase env is missing (dev without cloud).
  if (!configured) {
    return <AppShell>{children}</AppShell>
  }

  if (!authenticated) {
    return null
  }

  return (
    <AppShell>
      <OnboardingWizard />
      {children}
    </AppShell>
  )
}
