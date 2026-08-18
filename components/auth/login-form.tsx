"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { loginAction } from "@/lib/auth/actions"
import { DEFAULT_AUTH_REDIRECT } from "@/lib/auth/constants"
import { resolveSafeAuthNext } from "@/lib/auth/safe-next"

import {
  authInputClassName,
  FieldError,
  FieldLabel,
  FormError,
} from "./field"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    startTransition(async () => {
      const result = await loginAction({ email, password, rememberMe })
      if (!result.ok) {
        setError(result.error)
        setFieldErrors(result.fieldErrors ?? {})
        return
      }
      const target = resolveSafeAuthNext(
        searchParams.get("next"),
        result.redirectTo ?? DEFAULT_AUTH_REDIRECT
      )
      router.replace(target)
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormError>{error}</FormError>

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

      <div>
        <div className="flex items-center justify-between gap-3">
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Link
            href="/forgot-password"
            className="text-[13px] text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`mt-2 ${authInputClassName}`}
          aria-invalid={Boolean(fieldErrors.password)}
        />
        <FieldError>{fieldErrors.password}</FieldError>
      </div>

      <label className="flex items-center gap-2.5 text-[14px] text-muted-foreground">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="size-4 rounded border-border accent-primary"
        />
        Remember me
      </label>

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full text-[15px]"
      >
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}
