"use client"

import { useCallback, useEffect, useState } from "react"
import { Users } from "lucide-react"

import { FormError } from "@/components/auth/field"
import { InviteCoachForm } from "@/components/coaching/invite-coach-form"
import { PermissionChips } from "@/components/coaching/permission-checkbox-list"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { postRevokeCoachRelationship } from "@/lib/coach/client-api"
import {
  listClientInvitations,
  listParticipantRelationships,
  revokePendingInvitationRpc,
  type CoachInvitationRow,
  type CoachRelationshipRow,
} from "@/lib/coach/queries"
import { createClientOrNull } from "@/lib/supabase/client"
import { useUser } from "@/hooks/auth"

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return iso
  }
}

export function MyCoachesPanel() {
  const { user } = useUser()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invitations, setInvitations] = useState<CoachInvitationRow[]>([])
  const [relationships, setRelationships] = useState<CoachRelationshipRow[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const supabase = createClientOrNull()
    if (!supabase || !user) {
      setLoading(false)
      return
    }
    setError(null)
    const [inv, rel] = await Promise.all([
      listClientInvitations(supabase),
      listParticipantRelationships(supabase),
    ])
    if (!inv.ok) {
      setError(inv.error)
      setLoading(false)
      return
    }
    if (!rel.ok) {
      setError(rel.error)
      setLoading(false)
      return
    }
    setInvitations(inv.data)
    setRelationships(
      rel.data.filter(
        (r) => r.client_user_id === user.id && r.status === "active"
      )
    )
    setLoading(false)
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function revokeInvite(id: string) {
    const supabase = createClientOrNull()
    if (!supabase) return
    setBusyId(id)
    setError(null)
    const result = await revokePendingInvitationRpc(supabase, id)
    if (!result.ok) setError(result.error)
    await refresh()
    setBusyId(null)
  }

  async function revokeRelationship(id: string) {
    setBusyId(id)
    setError(null)
    const result = await postRevokeCoachRelationship(id)
    if (!result.ok) setError(result.error.error)
    await refresh()
    setBusyId(null)
  }

  if (loading) {
    return (
      <div className="space-y-3 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  const pending = invitations.filter((i) => i.status === "pending")

  return (
    <div className="space-y-8 p-4 md:p-6">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          My Coaches
        </h2>
        <p className="text-[14px] text-muted-foreground">
          Invite a Coach and choose exactly which categories they can see.
        </p>
      </header>

      <FormError>{error}</FormError>

      <section className="space-y-3">
        <h3 className="text-[12px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Invite a Coach
        </h3>
        <div className="rounded-2xl border border-border/40 bg-card/20 p-4 md:p-5">
          <InviteCoachForm onCreated={() => void refresh()} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-[12px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Active Coaches
        </h3>
        {relationships.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No active Coaches"
            description="When a Coach accepts your invitation, they will appear here."
          />
        ) : (
          <ul className="space-y-3">
            {relationships.map((rel) => (
              <li
                key={rel.id}
                className="rounded-xl border border-border/40 bg-card/20 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <p className="text-[14px] font-medium text-foreground">
                      Active Coach
                    </p>
                    <PermissionChips permissions={rel.permissions} />
                    {rel.accepted_at ? (
                      <p className="text-[12px] text-muted-foreground">
                        Accepted {formatDate(rel.accepted_at)}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={busyId === rel.id}
                    onClick={() => void revokeRelationship(rel.id)}
                  >
                    {busyId === rel.id ? "Revoking…" : "Revoke access"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-[12px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Pending invitations
        </h3>
        {pending.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            No pending invitations.
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.map((inv) => (
              <li
                key={inv.id}
                className="rounded-xl border border-border/40 bg-card/20 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <p className="text-[14px] font-medium text-foreground">
                      {inv.coach_email}
                    </p>
                    <PermissionChips permissions={inv.permissions} />
                    <p className="text-[12px] text-muted-foreground">
                      Expires {formatDate(inv.expires_at)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyId === inv.id}
                    onClick={() => void revokeInvite(inv.id)}
                  >
                    {busyId === inv.id ? "Revoking…" : "Revoke invitation"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
