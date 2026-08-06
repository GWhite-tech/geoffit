"use client"

import { useState, useTransition } from "react"
import { format } from "date-fns"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePreferences } from "@/components/preferences/preferences-provider"
import { useProfile, useUser } from "@/hooks/auth"
import {
  logoutAction,
  updatePasswordAction,
} from "@/lib/auth/actions"

import {
  authInputClassName,
  FieldError,
  FieldLabel,
  FormError,
  FormSuccess,
} from "./field"

function initials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
  }
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase() || "G"
}

export function AccountPanel() {
  const { user } = useUser()
  const { profile, loading } = useProfile()
  const { preferences } = usePreferences()
  const [pending, startTransition] = useTransition()
  const [pwPending, startPwTransition] = useTransition()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState<string | null>(null)
  const [pwFieldErrors, setPwFieldErrors] = useState<Record<string, string>>({})
  const [deleteArmed, setDeleteArmed] = useState(false)

  if (loading && !profile) {
    return (
      <p className="text-[14px] text-muted-foreground">Loading account…</p>
    )
  }

  const display =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user?.email ||
    "Account"

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-12 px-6 py-10 lg:px-12">
      <header>
        <h1 className="text-[32px] font-semibold tracking-tight text-foreground">
          Account
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Your Geoffit identity, preferences, and security controls.
        </p>
      </header>

      <section className="flex items-center gap-5">
        <Avatar className="size-16 after:border-border/40">
          {profile?.avatar_url ? (
            <AvatarImage src={profile.avatar_url} alt={display} />
          ) : null}
          <AvatarFallback className="bg-card text-[18px] text-foreground/80">
            {initials(display, profile?.email ?? user?.email ?? "")}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-[20px] font-semibold tracking-tight">{display}</p>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {profile?.email ?? user?.email}
          </p>
        </div>
      </section>

      <section>
        <h3 className="text-[13px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
          Profile
        </h3>
        <dl className="mt-2 divide-y divide-border/25">
          <Row label="Display name" value={profile?.display_name || "—"} />
          <Row label="Email" value={profile?.email ?? user?.email ?? "—"} />
          <Row
            label="User ID"
            value={profile?.id ?? user?.id ?? "—"}
            mono
          />
          <Row
            label="Created"
            value={
              profile?.created_at
                ? format(new Date(profile.created_at), "d MMM yyyy, HH:mm")
                : "—"
            }
          />
          <Row label="Theme" value={preferences?.theme ?? "system"} />
          <Row label="Units" value={preferences?.units ?? "metric"} />
          <Row label="Timezone" value={preferences?.timezone ?? "—"} />
          <Row label="Locale" value={preferences?.locale ?? "—"} />
        </dl>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[13px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
            Security
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? "Hide" : "Change password"}
          </Button>
        </div>

        {showPassword ? (
          <form
            className="space-y-4 rounded-xl border border-border/40 bg-card/20 p-5"
            onSubmit={(e) => {
              e.preventDefault()
              setPwError(null)
              setPwSuccess(null)
              setPwFieldErrors({})
              startPwTransition(async () => {
                const result = await updatePasswordAction(
                  password,
                  confirmPassword
                )
                if (!result.ok) {
                  setPwError(result.error)
                  setPwFieldErrors(result.fieldErrors ?? {})
                  return
                }
                setPwSuccess(result.message ?? "Password updated.")
                setPassword("")
                setConfirmPassword("")
              })
            }}
          >
            <FormError>{pwError}</FormError>
            <FormSuccess>{pwSuccess}</FormSuccess>
            <div>
              <FieldLabel htmlFor="new-password">New password</FieldLabel>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`mt-2 ${authInputClassName}`}
              />
              <FieldError>{pwFieldErrors.password}</FieldError>
            </div>
            <div>
              <FieldLabel htmlFor="confirm-new-password">
                Confirm password
              </FieldLabel>
              <Input
                id="confirm-new-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`mt-2 ${authInputClassName}`}
              />
              <FieldError>{pwFieldErrors.confirmPassword}</FieldError>
            </div>
            <Button type="submit" disabled={pwPending} className="h-10">
              {pwPending ? "Updating…" : "Save password"}
            </Button>
          </form>
        ) : null}
      </section>

      <section className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-10"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              await logoutAction()
            })
          }}
        >
          Sign out
        </Button>

        <Button
          type="button"
          variant="destructive"
          className="h-10"
          disabled
          title="Coming soon"
          onClick={() => setDeleteArmed(true)}
        >
          Delete account
        </Button>
      </section>

      {deleteArmed ? (
        <p className="text-[13px] text-muted-foreground">
          Account deletion will be available after cloud data migration. Your
          local health stores are not affected by signing out.
        </p>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          Delete account is disabled until cloud migration ships.
        </p>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="grid gap-2 py-4 sm:grid-cols-[200px_1fr] sm:gap-6">
      <dt className="text-[14px] text-muted-foreground">{label}</dt>
      <dd
        className={
          mono
            ? "font-mono text-[13px] break-all text-foreground"
            : "text-[15px] break-all text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  )
}
