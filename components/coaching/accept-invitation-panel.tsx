"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { FormError, FormSuccess } from "@/components/auth/field"
import { PermissionChips } from "@/components/coaching/permission-checkbox-list"
import { Button } from "@/components/ui/button"
import { parseAcceptTokenFromSearchParams } from "@/lib/coach/accept-token"
import { postAcceptCoachInvitation } from "@/lib/coach/client-api"
import {
  listInviteePendingInvitations,
  type CoachInvitationRow,
} from "@/lib/coach/queries"
import { createClientOrNull } from "@/lib/supabase/client"

export function AcceptInvitationPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const parsed = useMemo(
    () => parseAcceptTokenFromSearchParams(searchParams),
    [searchParams]
  )

  const [pending, setPending] = useState<CoachInvitationRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClientOrNull()
    if (!supabase) return
    void listInviteePendingInvitations(supabase).then((result) => {
      if (result.ok) setPending(result.data)
    })
  }, [])

  async function onAccept() {
    setError(null)
    setSuccess(null)
    if (!parsed.ok) {
      setError(
        parsed.reason === "hash_field"
          ? "Invalid invitation link."
          : "This invitation link is missing a valid token."
      )
      return
    }
    setSubmitting(true)
    try {
      const result = await postAcceptCoachInvitation({ token: parsed.token })
      if (!result.ok) {
        setError(result.error.error)
        return
      }
      setSuccess("Invitation accepted.")
      const clientId = result.data.clientUserId
      if (clientId) {
        router.replace(`/coaching/clients/${clientId}`)
      } else {
        router.replace("/coaching?tab=clients")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4 md:p-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Accept Coach invitation
        </h1>
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          You are accepting a client&apos;s invitation to view the categories
          they chose to share. Access is read-only and can be revoked at any
          time.
        </p>
      </header>

      {pending.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-[12px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            Pending invitations for your account
          </h2>
          <ul className="space-y-3">
            {pending.map((inv) => (
              <li
                key={inv.id}
                className="rounded-xl border border-border/40 bg-card/20 px-4 py-3 space-y-2"
              >
                <p className="text-[14px] text-foreground">
                  Invitation from a Geoffit client
                </p>
                <PermissionChips permissions={inv.permissions} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <FormError>{error}</FormError>
      <FormSuccess>{success}</FormSuccess>

      {!parsed.ok ? (
        <FormError>
          {parsed.reason === "hash_field"
            ? "This link is invalid."
            : "Open the invitation link your client shared to continue."}
        </FormError>
      ) : (
        <Button type="button" disabled={submitting} onClick={() => void onAccept()}>
          {submitting ? "Accepting…" : "Accept invitation"}
        </Button>
      )}
    </div>
  )
}
