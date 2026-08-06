"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { resetPasswordAction } from "@/lib/auth/actions"
import { DEFAULT_AUTH_REDIRECT } from "@/lib/auth/constants"

import {
  authInputClassName,
  FieldError,
  FieldLabel,
  FormError,
  FormSuccess,
} from "./field"

export function ResetPasswordForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setFieldErrors({})
    startTransition(async () => {
      const result = await resetPasswordAction(password, confirmPassword)
      if (!result.ok) {
        setError(result.error)
        setFieldErrors(result.fieldErrors ?? {})
        return
      }
      setDone(true)
      setSuccess(result.message ?? "Password updated.")
    })
  }

  if (done) {
    return (
      <div className="space-y-5">
        <FormSuccess>{success}</FormSuccess>
        <Button
          type="button"
          className="h-11 w-full text-[15px]"
          onClick={() => {
            router.replace(DEFAULT_AUTH_REDIRECT)
            router.refresh()
          }}
        >
          Continue to Geoffit
        </Button>
        <p className="text-center text-[13px] text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormError>{error}</FormError>

      <div>
        <FieldLabel htmlFor="password">New password</FieldLabel>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`mt-2 ${authInputClassName}`}
          aria-invalid={Boolean(fieldErrors.password)}
        />
        <FieldError>{fieldErrors.password}</FieldError>
      </div>

      <div>
        <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={`mt-2 ${authInputClassName}`}
          aria-invalid={Boolean(fieldErrors.confirmPassword)}
        />
        <FieldError>{fieldErrors.confirmPassword}</FieldError>
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full text-[15px]"
      >
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  )
}
