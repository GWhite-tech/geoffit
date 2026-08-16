"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { FormError } from "@/components/auth/field"
import { CategoryLockCard } from "@/components/coaching/category-lock-card"
import { MyClientsPanel } from "@/components/coaching/my-clients-panel"
import { PermissionChips } from "@/components/coaching/permission-checkbox-list"
import { Skeleton } from "@/components/ui/skeleton"
import { buttonVariants } from "@/components/ui/button"
import type { CoachPermissionCategory } from "@/lib/coach/categories"
import {
  COACH_PERMISSION_CATEGORIES,
  permissionsInclude,
  permissionsIncludeAny,
} from "@/lib/coach/categories"
import {
  fetchCoachMissionControl,
  type CoachMissionControlResponse,
} from "@/lib/coach/client-api"
import { fetchCoachVisibleClientProfile } from "@/lib/coach/queries"
import { coachPermissionCopy } from "@/lib/coach/ui-labels"
import { createClientOrNull } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

function DomainCard({
  title,
  status,
  detail,
}: {
  title: string
  status: "ok" | "empty" | "error" | "locked"
  detail: string
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/20 px-4 py-4">
      <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-[16px] font-semibold text-foreground">
        {status === "ok"
          ? "Available"
          : status === "empty"
            ? "No data"
            : status === "error"
              ? "Error"
              : "Not granted"}
      </p>
      <p className="mt-1 text-[13px] text-muted-foreground">{detail}</p>
    </div>
  )
}

export function CoachClientDashboard({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [data, setData] = useState<CoachMissionControlResponse | null>(null)
  const fetchGen = useRef(0)

  useEffect(() => {
    const gen = ++fetchGen.current
    setData(null)
    setDisplayName(null)
    setError(null)
    setLoading(true)

    ;(async () => {
      const supabase = createClientOrNull()
      if (supabase) {
        const profile = await fetchCoachVisibleClientProfile(supabase, clientId)
        if (fetchGen.current !== gen) return
        setDisplayName(
          profile?.displayName?.trim() || `Client ${clientId.slice(0, 8)}`
        )
      }

      const result = await fetchCoachMissionControl(clientId, "90d")
      if (fetchGen.current !== gen) return
      if (!result.ok) {
        setError(result.error.error)
        setLoading(false)
        return
      }
      if (result.data.clientUserId !== clientId) {
        setError("Client data mismatch.")
        setLoading(false)
        return
      }
      setData(result.data)
      setLoading(false)
    })()
  }, [clientId])

  const granted: readonly CoachPermissionCategory[] =
    data?.grantedPermissions ?? []
  const healthGranted = permissionsIncludeAny(granted, [
    "vitals",
    "sleep",
    "body",
    "nutrition",
  ])

  return (
    <div className="min-h-full">
      <div className="border-b border-border/30">
        <MyClientsPanel selectedClientId={clientId} />
      </div>

      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/coaching?tab=clients"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <ArrowLeft className="size-4" />
            All clients
          </Link>
        </div>

        <header className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {displayName ?? "Client"}
          </h2>
          <p className="text-[14px] text-muted-foreground">
            Coach Mission Control — only categories this client shared with you.
          </p>
          {granted.length > 0 ? (
            <PermissionChips permissions={granted} />
          ) : null}
        </header>

        <FormError>{error}</FormError>

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <DomainCard
                title="Training"
                status={
                  permissionsInclude(granted, "training")
                    ? data.domainStatus.workouts
                    : "locked"
                }
                detail={
                  permissionsInclude(granted, "training")
                    ? `${
                        (data.hevyWorkouts?.length ?? 0) +
                        (data.appleHealthWorkouts?.length ?? 0)
                      } workouts in range`
                    : coachPermissionCopy("training").description
                }
              />
              <DomainCard
                title="Blood"
                status={
                  permissionsInclude(granted, "blood")
                    ? data.domainStatus.blood
                    : "locked"
                }
                detail={
                  permissionsInclude(granted, "blood")
                    ? `${data.bloodTests?.length ?? 0} panels in range`
                    : coachPermissionCopy("blood").description
                }
              />
              <DomainCard
                title="Treatments"
                status={
                  permissionsInclude(granted, "treatments")
                    ? data.domainStatus.treatments
                    : "locked"
                }
                detail={
                  permissionsInclude(granted, "treatments")
                    ? `${data.treatments?.length ?? 0} treatments`
                    : coachPermissionCopy("treatments").description
                }
              />
              <DomainCard
                title="Health metrics"
                status={
                  healthGranted ? data.domainStatus.health : "locked"
                }
                detail={
                  healthGranted
                    ? `${data.healthRecords?.length ?? 0} records in range`
                    : "Vitals, sleep, body, or nutrition access required."
                }
              />
            </div>

            <section className="space-y-3">
              <h3 className="text-[12px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                Category access
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {COACH_PERMISSION_CATEGORIES.map((category) =>
                  permissionsInclude(granted, category) ? (
                    <div
                      key={category}
                      className="rounded-xl border border-border/40 bg-card/20 px-4 py-4"
                    >
                      <p className="text-[14px] font-medium text-foreground">
                        {coachPermissionCopy(category).label}
                      </p>
                      <p className="mt-1 text-[13px] text-muted-foreground">
                        Granted — loaded via the Coach Mission Control API only.
                      </p>
                    </div>
                  ) : (
                    <CategoryLockCard key={category} category={category} />
                  )
                )}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  )
}
