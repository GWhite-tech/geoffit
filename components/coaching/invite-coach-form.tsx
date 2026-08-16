"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"

import { FieldError, FieldLabel, FormError, FormSuccess } from "@/components/auth/field"
import { PermissionCheckboxList } from "@/components/coaching/permission-checkbox-list"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { CoachPermissionCategory } from "@/lib/coach/categories"
import {
  buildCoachAcceptUrl,
  postCreateCoachInvitation,
} from "@/lib/coach/client-api"

export function InviteCoachForm({
  onCreated,
}: {
  onCreated: () => void
}) {
  const [email, setEmail] = useState("")
  const [permissions, setPermissions] = useState<CoachPermissionCategory[]>([
    "training",
  ])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setAcceptUrl(null)
    setCopied(false)
    if (permissions.length === 0) {
      setError("Select at least one permission.")
      return
    }
    setSubmitting(true)
    try {
      const result = await postCreateCoachInvitation({
        coachEmail: email,
        permissions,
      })
      if (!result.ok) {
        setError(result.error.error)
        return
      }
      const url = buildCoachAcceptUrl(window.location.origin, result.data.token)
      setAcceptUrl(url)
      setEmail("")
      setPermissions(["training"])
      onCreated()
    } finally {
      setSubmitting(false)
    }
  }

  async function copyLink() {
    if (!acceptUrl) return
    try {
      await navigator.clipboard.writeText(acceptUrl)
      setCopied(true)
    } catch {
      setError("Could not copy link. Copy it manually from the field below.")
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <FieldLabel htmlFor="coach-email">Coach email</FieldLabel>
        <Input
          id="coach-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="coach@example.com"
          disabled={submitting}
        />
        <FieldError>
          {!email.includes("@") && email.length > 0
            ? "Enter a valid email address."
            : null}
        </FieldError>
      </div>

      <div className="space-y-2">
        <FieldLabel>Permissions</FieldLabel>
        <p className="text-[13px] text-muted-foreground">
          Choose exactly what this Coach can see. You can revoke access later.
        </p>
        <PermissionCheckboxList
          selected={permissions}
          onChange={setPermissions}
          disabled={submitting}
        />
      </div>

      <FormError>{error}</FormError>

      {acceptUrl ? (
        <div className="space-y-2">
          <FormSuccess>
            Invitation created. Share this one-time link with your Coach. It will
            not be shown again.
          </FormSuccess>
          <div className="flex gap-2">
            <Input readOnly value={acceptUrl} className="font-mono text-[12px]" />
            <Button type="button" variant="outline" onClick={copyLink}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : null}

      <Button type="submit" disabled={submitting || permissions.length === 0}>
        {submitting ? "Creating…" : "Create invitation"}
      </Button>
    </form>
  )
}
