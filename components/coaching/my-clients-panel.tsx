"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Users } from "lucide-react"

import { FormError } from "@/components/auth/field"
import { PermissionChips } from "@/components/coaching/permission-checkbox-list"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { buttonVariants } from "@/components/ui/button"
import { useUser } from "@/hooks/auth"
import {
  fetchCoachVisibleClientProfile,
  listParticipantRelationships,
  type CoachRelationshipRow,
} from "@/lib/coach/queries"
import { createClientOrNull } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type ClientOption = {
  relationship: CoachRelationshipRow
  displayName: string
}

export function MyClientsPanel({
  selectedClientId,
}: {
  selectedClientId?: string
}) {
  const { user } = useUser()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clients, setClients] = useState<ClientOption[]>([])

  const refresh = useCallback(async () => {
    const supabase = createClientOrNull()
    if (!supabase || !user) {
      setLoading(false)
      return
    }
    setError(null)
    const rel = await listParticipantRelationships(supabase)
    if (!rel.ok) {
      setError(rel.error)
      setLoading(false)
      return
    }
    const active = rel.data.filter(
      (r) => r.coach_user_id === user.id && r.status === "active"
    )
    const options: ClientOption[] = []
    for (const relationship of active) {
      const profile = await fetchCoachVisibleClientProfile(
        supabase,
        relationship.client_user_id
      )
      options.push({
        relationship,
        displayName:
          profile?.displayName?.trim() ||
          `Client ${relationship.client_user_id.slice(0, 8)}`,
      })
    }
    setClients(options)
    setLoading(false)

    if (!selectedClientId && options.length === 1) {
      router.replace(`/coaching/clients/${options[0].relationship.client_user_id}`)
    }
  }, [user, selectedClientId, router])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (loading) {
    return (
      <div className="space-y-3 p-4 md:p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          My Clients
        </h2>
        <p className="text-[14px] text-muted-foreground">
          Open a client to view the categories they have shared with you.
        </p>
      </header>

      <FormError>{error}</FormError>

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="When a client invites you and you accept, they will show up here."
        />
      ) : (
        <>
          {clients.length > 1 ? (
            <label className="block space-y-2">
              <span className="text-[12px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                Select client
              </span>
              <select
                className="h-10 w-full max-w-md rounded-xl border border-border/40 bg-card/30 px-3 text-[14px] text-foreground"
                value={selectedClientId ?? ""}
                onChange={(e) => {
                  const id = e.target.value
                  if (id) router.push(`/coaching/clients/${id}`)
                }}
              >
                <option value="" disabled>
                  Choose a client…
                </option>
                {clients.map((c) => (
                  <option
                    key={c.relationship.id}
                    value={c.relationship.client_user_id}
                  >
                    {c.displayName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <ul className="space-y-3">
            {clients.map((c) => {
              const active =
                selectedClientId === c.relationship.client_user_id
              return (
                <li
                  key={c.relationship.id}
                  className={`rounded-xl border px-4 py-3 ${
                    active
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/40 bg-card/20"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <p className="text-[15px] font-medium text-foreground">
                        {c.displayName}
                      </p>
                      <PermissionChips
                        permissions={c.relationship.permissions}
                      />
                    </div>
                    <Link
                      href={`/coaching/clients/${c.relationship.client_user_id}`}
                      className={cn(
                        buttonVariants({
                          variant: active ? "secondary" : "default",
                          size: "sm",
                        })
                      )}
                    >
                      {active ? "Viewing" : "Open"}
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
