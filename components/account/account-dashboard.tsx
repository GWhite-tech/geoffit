"use client"

import Link from "next/link"
import { format } from "date-fns"
import { useEffect, useMemo, useState, useTransition } from "react"
import {
  ChevronRight,
  Cloud,
  Download,
  LogOut,
  Settings,
  Share2,
  UserRound,
} from "lucide-react"

import { MobilePage, SectionHeader } from "@/components/mobile"
import { usePreferences } from "@/components/preferences/preferences-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { useProfile, useUser } from "@/hooks/auth"
import { logoutAction } from "@/lib/auth/actions"
import { summarizeConnectedSources } from "@/lib/connected-sources"
import { createClientOrNull } from "@/lib/supabase/client"
import { loadCloudStatus } from "@/lib/supabase/status"
import { cn } from "@/lib/utils"

function Row({
  href,
  icon: Icon,
  label,
  value,
  onClick,
  danger,
}: {
  href?: string
  icon: typeof Settings
  label: string
  value?: string
  onClick?: () => void
  danger?: boolean
}) {
  const className = cn(
    "flex min-h-14 w-full items-center gap-3 border-b border-white/[0.05] px-1 py-3 text-left transition-colors active:bg-white/[0.03]",
    danger && "text-danger"
  )

  const body = (
    <>
      <Icon
        className={cn(
          "size-5 shrink-0",
          danger ? "text-danger" : "text-muted-foreground"
        )}
      />
      <span
        className={cn(
          "min-w-0 flex-1 text-[16px] font-medium",
          danger ? "text-danger" : "text-foreground"
        )}
      >
        {label}
      </span>
      {value ? (
        <span className="max-w-[40%] truncate text-[13px] text-muted-foreground">
          {value}
        </span>
      ) : null}
      {href || onClick ? (
        <ChevronRight className="size-4 text-muted-foreground/45" />
      ) : null}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  )
}

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
        setCloudLabel("Connected")
      } else {
        setCloudLabel(status.connectionStatus)
      }
    })
  }, [user?.id])

  if (userLoading || profileLoading) {
    return (
      <MobilePage className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </MobilePage>
    )
  }

  const display =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    greetingName
  const memberSince = profile?.created_at
    ? format(new Date(profile.created_at), "MMMM yyyy")
    : "—"

  return (
    <MobilePage title="Account" className="space-y-10">
      <section className="flex items-center gap-4 px-1">
        <Avatar className="size-16 after:border-white/10">
          {profile?.avatar_url ? (
            <AvatarImage src={profile.avatar_url} alt={display} />
          ) : null}
          <AvatarFallback className="bg-white/[0.06] text-[18px]">
            {(display || "G").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-[22px] font-semibold tracking-tight">
            {display || greetingName}
          </p>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Member since {memberSince}
          </p>
        </div>
      </section>

      <section>
        <SectionHeader title="Profile" className="mb-2" />
        <div className="rounded-2xl bg-white/[0.03] px-3 ring-1 ring-white/[0.05]">
          <Row
            href="/settings?category=profile"
            icon={UserRound}
            label="Profile"
            value={preferences?.units === "imperial" ? "Imperial" : "Metric"}
          />
          <Row
            href="/settings"
            icon={Settings}
            label="Settings"
          />
        </div>
      </section>

      <section>
        <SectionHeader title="Connected services" className="mb-2" />
        <div className="rounded-2xl bg-white/[0.03] px-3 ring-1 ring-white/[0.05]">
          <Row
            href="/settings?category=health_sources"
            icon={Cloud}
            label="Apple Health"
            value={cloudLabel}
          />
          <Row
            href="/import"
            icon={Download}
            label="Blood imports"
            value={`${sources.connected} sources`}
          />
          <Row
            href="/settings?category=cloud"
            icon={Share2}
            label="Invite coach"
            value="Soon"
          />
        </div>
      </section>

      <section>
        <div className="rounded-2xl bg-white/[0.03] px-3 ring-1 ring-white/[0.05]">
          <Row
            icon={LogOut}
            label={pending ? "Signing out…" : "Sign out"}
            danger
            onClick={() => startTransition(async () => logoutAction())}
          />
        </div>
      </section>
    </MobilePage>
  )
}
