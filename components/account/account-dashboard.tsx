"use client"

import Link from "next/link"
import { format } from "date-fns"
import { useMemo, useTransition } from "react"

import { AdaptiveGrid } from "@/components/layout/adaptive-grid"
import { ResponsiveCard } from "@/components/layout/responsive-card"
import { ResponsivePage } from "@/components/layout/responsive-page"
import { usePreferences } from "@/components/preferences/preferences-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useProfile, useUser } from "@/hooks/auth"
import { logoutAction } from "@/lib/auth/actions"
import { summarizeConnectedSources } from "@/lib/connected-sources"
import { createClientOrNull } from "@/lib/supabase/client"
import { loadCloudStatus } from "@/lib/supabase/status"
import { useEffect, useState } from "react"

export function AccountDashboard() {
  const { user, loading: userLoading } = useUser()
  const { profile, greetingName, loading: profileLoading } = useProfile()
  const { preferences } = usePreferences()
  const [pending, startTransition] = useTransition()
  const [cloudLabel, setCloudLabel] = useState("Checking…")
  const sources = useMemo(() => summarizeConnectedSources(), [])

  useEffect(() => {
    void loadCloudStatus(createClientOrNull()).then((status) => {
      if (status.connectionStatus === "not_configured") {
        setCloudLabel("Not configured")
      } else if (status.authStatus === "Signed in") {
        setCloudLabel("Connected · signed in")
      } else {
        setCloudLabel(status.connectionStatus)
      }
    })
  }, [user?.id])

  if (userLoading || profileLoading) {
    return (
      <ResponsivePage narrow className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </ResponsivePage>
    )
  }

  const display =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    greetingName
  const memberSince = profile?.created_at
    ? format(new Date(profile.created_at), "MMMM yyyy")
    : "—"

  const securityScore =
    (user ? 40 : 0) +
    (preferences?.show_welcome_screen === false ? 20 : 10) +
    30

  return (
    <ResponsivePage className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 after:border-border/40">
            {profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={display} />
            ) : null}
            <AvatarFallback className="bg-card text-[18px]">
              {(display || "G").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-[13px] tracking-[0.14em] text-muted-foreground uppercase">
              Account
            </p>
            <h1 className="mt-1 text-[32px] font-semibold tracking-tight">
              Hello, {greetingName}
            </h1>
            <p className="mt-1 text-[14px] text-muted-foreground">
              Member since {memberSince}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href="/settings" />} variant="outline" className="h-9">
            Open Settings
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9"
            disabled={pending}
            onClick={() => startTransition(async () => logoutAction())}
          >
            Sign out
          </Button>
        </div>
      </header>

      <AdaptiveGrid cols={3}>
        <StatCard title="Subscription" value="Founder preview" hint="Billing later" />
        <StatCard title="Cloud status" value={cloudLabel} hint="Supabase foundation" />
        <StatCard
          title="Security score"
          value={`${Math.min(securityScore, 100)}`}
          hint="Password + privacy posture"
        />
        <StatCard
          title="Health sources"
          value={`${sources.connected} connected`}
          hint={`${sources.comingSoon} coming soon`}
        />
        <StatCard title="Storage usage" value="Local only" hint="Cloud metering later" />
        <StatCard
          title="Recent devices"
          value="This browser"
          hint="Device inventory coming soon"
        />
      </AdaptiveGrid>

      <ResponsiveCard>
        <p className="text-[13px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
          Quick actions
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button render={<Link href="/settings?category=privacy" />} variant="outline" className="h-9">
            Change password
          </Button>
          <Button render={<Link href="/settings?category=health_sources" />} variant="outline" className="h-9">
            Manage sources
          </Button>
          <Button render={<Link href="/settings?category=cloud" />} variant="outline" className="h-9">
            Cloud & migration
          </Button>
          <Button render={<Link href="/import" />} variant="outline" className="h-9">
            Import data
          </Button>
        </div>
      </ResponsiveCard>
    </ResponsivePage>
  )
}

function StatCard({
  title,
  value,
  hint,
}: {
  title: string
  value: string
  hint: string
}) {
  return (
    <ResponsiveCard>
      <p className="text-[12px] tracking-[0.12em] text-muted-foreground uppercase">
        {title}
      </p>
      <p className="mt-3 text-[22px] font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-2 text-[13px] text-muted-foreground">{hint}</p>
    </ResponsiveCard>
  )
}
