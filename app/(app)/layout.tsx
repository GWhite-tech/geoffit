"use client"

import { useAuthContext } from "@/components/auth/auth-provider"
import { AppShell } from "@/components/layout/app-shell"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"
import { useRequireAuth } from "@/hooks/auth"
import { resolveAuthShellPhase } from "@/lib/auth/startup-shell"

function ShellSkeleton() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <p className="text-[14px] text-muted-foreground">Loading…</p>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { configured, user, loading: sessionPending } = useAuthContext()
  const { authenticated } = useRequireAuth(configured)

  const phase = resolveAuthShellPhase({
    configured,
    sessionPending: configured && sessionPending,
    user: configured ? user : null,
  })

  // Local-first fallback when Supabase env is missing (dev without cloud).
  if (phase === "unconfigured") {
    return <AppShell>{children}</AppShell>
  }

  // Session still resolving — paint chrome, not a full-viewport auth gate.
  if (phase === "session_pending") {
    return (
      <AppShell>
        <ShellSkeleton />
      </AppShell>
    )
  }

  // No session after settle — redirect via useRequireAuth; do not expose children.
  if (phase === "unauthenticated" || !authenticated) {
    return null
  }

  return (
    <AppShell>
      <OnboardingWizard />
      {children}
    </AppShell>
  )
}
