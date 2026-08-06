"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { usePreferences } from "@/components/preferences/preferences-provider"
import { useProfile, useUser } from "@/hooks/auth"
import { logoutAction } from "@/lib/auth/actions"
import { createClientOrNull } from "@/lib/supabase/client"
import { loadCloudStatus, type CloudStatus } from "@/lib/supabase/status"
import { cn } from "@/lib/utils"

import { MigrationWizard } from "./migration-wizard"

const INITIAL: CloudStatus = {
  connectionStatus: "not_configured",
  projectUrl: null,
  environment: "Development",
  authStatus: "Unknown",
  signedInEmail: null,
  databaseReachable: null,
  setupMessage: null,
}

export function CloudPanel() {
  const { user } = useUser()
  const { profile, greetingName } = useProfile()
  const { preferences } = usePreferences()
  const [status, setStatus] = useState<CloudStatus>(INITIAL)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        const supabase = createClientOrNull()
        const next = await loadCloudStatus(supabase)
        if (!cancelled) setStatus(next)
      } catch {
        if (!cancelled) {
          setStatus({
            ...INITIAL,
            connectionStatus: "unreachable",
            setupMessage:
              "Could not initialise the Supabase client. Check your environment variables and restart the app.",
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  if (status.connectionStatus === "not_configured") {
    return (
      <div className="space-y-8">
        <div className="rounded-xl border border-border/40 bg-card/20 px-5 py-5">
          <p className="text-[15px] font-medium text-foreground">
            Connect Supabase to enable cloud features
          </p>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
            {status.setupMessage ??
              "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."}
          </p>
        </div>
      </div>
    )
  }

  const display =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    greetingName
  const email = profile?.email ?? user?.email ?? status.signedInEmail

  return (
    <div className="space-y-10">
      <p className="max-w-xl text-[14px] leading-relaxed text-muted-foreground">
        Cloud sync uses Supabase with the public anon key only. Local health
        stores are unchanged — migration is prepared, not executed.
      </p>

      {user ? (
        <section className="rounded-xl border border-border/40 bg-card/20 px-5 py-5">
          <p className="text-[13px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
            Signed in as
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Avatar className="size-12 after:border-border/40">
              {profile?.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt={display} />
              ) : null}
              <AvatarFallback className="bg-card text-[14px]">
                {(display || "G").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-medium">{display}</p>
              <p className="truncate text-[14px] text-muted-foreground">{email}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Theme · {preferences?.theme ?? "system"} · Units ·{" "}
                {preferences?.units ?? "metric"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button render={<Link href="/account" />} variant="outline" className="h-9">
                Account
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9"
                disabled={pending}
                onClick={() => startTransition(async () => logoutAction())}
              >
                Log out
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <StatusList
        loading={loading}
        rows={[
          {
            label: "Supabase connection",
            value:
              status.connectionStatus === "connected"
                ? "Connected"
                : "Unreachable",
            tone:
              status.connectionStatus === "connected" ? "positive" : "warning",
          },
          {
            label: "Database status",
            value:
              status.databaseReachable == null
                ? "Checking…"
                : status.databaseReachable
                  ? "Reachable"
                  : "Unreachable",
            tone:
              status.databaseReachable == null
                ? "muted"
                : status.databaseReachable
                  ? "positive"
                  : "warning",
          },
          {
            label: "Storage usage",
            value: "Not metered yet",
            tone: "muted",
          },
          {
            label: "Offline cache",
            value: "Local stores active",
            tone: "positive",
          },
          {
            label: "Pending uploads",
            value: "0 (migration not started)",
            tone: "muted",
          },
          {
            label: "Last sync",
            value: "Health sync not enabled",
            tone: "muted",
          },
          {
            label: "Environment",
            value: status.environment,
            tone: "default",
          },
        ]}
      />

      <MigrationWizard />
    </div>
  )
}

type StatusRow = {
  label: string
  value: string
  tone: "default" | "positive" | "warning" | "muted"
}

function StatusList({
  rows,
  loading,
}: {
  rows: StatusRow[]
  loading: boolean
}) {
  return (
    <dl
      className={cn(
        "divide-y divide-border/25",
        loading && "opacity-70 transition-opacity"
      )}
    >
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid gap-2 py-4 sm:grid-cols-[200px_1fr] sm:gap-6"
        >
          <dt className="text-[14px] text-muted-foreground">{row.label}</dt>
          <dd
            className={cn(
              "text-[15px]",
              row.tone === "positive" && "text-foreground",
              row.tone === "warning" && "text-amber-600 dark:text-amber-400",
              row.tone === "muted" && "text-muted-foreground",
              row.tone === "default" && "text-foreground"
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
