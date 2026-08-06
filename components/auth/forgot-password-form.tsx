"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { forgotPasswordAction } from "@/lib/auth/actions"

import {
  authInputClassName,
  FieldError,
  FieldLabel,
  FormError,
  FormSuccess,
} from "./field"

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setFieldErrors({})
    startTransition(async () => {
      const result = await forgotPasswordAction(email)
      if (!result.ok) {
        setError(result.error)
        setFieldErrors(result.fieldErrors ?? {})
        return
      }
      setSuccess(result.message ?? "Check your email.")
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormError>{error}</FormError>
      <FormSuccess>{success}</FormSuccess>

      <div>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`mt-2 ${authInputClassName}`}
          aria-invalid={Boolean(fieldErrors.email)}
        />
        <FieldError>{fieldErrors.email}</FieldError>
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full text-[15px]"
      >
        {pending ? "Sending…" : "Send reset email"}
      </Button>
    </form>
  )
}
