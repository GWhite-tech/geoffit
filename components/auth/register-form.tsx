"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { registerAction } from "@/lib/auth/actions"
import type { ThemePreference, UnitsPreference } from "@/lib/auth/types"
import { useTheme } from "@/components/theme/theme-provider"

import {
  authInputClassName,
  ChoiceChip,
  ChoiceGroup,
  FieldError,
  FieldLabel,
  FormError,
  FormSuccess,
} from "./field"

export function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setTheme } = useTheme()
  const [pending, startTransition] = useTransition()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [theme, setThemeChoice] = useState<ThemePreference>("system")
  const [units, setUnits] = useState<UnitsPreference>("metric")
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setFieldErrors({})
    startTransition(async () => {
      const next = searchParams.get("next")
      const result = await registerAction({
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
        theme,
        units,
        acceptTerms,
        next,
      })
      if (!result.ok) {
        setError(result.error)
        setFieldErrors(result.fieldErrors ?? {})
        return
      }
      setTheme(theme)
      if (result.redirectTo) {
        router.replace(result.redirectTo)
        router.refresh()
        return
      }
      setSuccess(result.message ?? "Account created.")
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormError>{error}</FormError>
      <FormSuccess>{success}</FormSuccess>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="firstName">First name</FieldLabel>
          <Input
            id="firstName"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={`mt-2 ${authInputClassName}`}
            aria-invalid={Boolean(fieldErrors.firstName)}
          />
          <FieldError>{fieldErrors.firstName}</FieldError>
        </div>
        <div>
          <FieldLabel htmlFor="lastName">Last name</FieldLabel>
          <Input
            id="lastName"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={`mt-2 ${authInputClassName}`}
            aria-invalid={Boolean(fieldErrors.lastName)}
          />
          <FieldError>{fieldErrors.lastName}</FieldError>
        </div>
      </div>

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
        <FieldLabel htmlFor="password">Password</FieldLabel>
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

      <ChoiceGroup label="Appearance">
        {(
          [
            ["light", "Light"],
            ["dark", "Dark"],
            ["system", "System"],
          ] as const
        ).map(([value, label]) => (
          <ChoiceChip
            key={value}
            selected={theme === value}
            onClick={() => {
              setThemeChoice(value)
              setTheme(value)
            }}
          >
            {label}
          </ChoiceChip>
        ))}
      </ChoiceGroup>
      <FieldError>{fieldErrors.theme}</FieldError>

      <ChoiceGroup label="Units">
        {(
          [
            ["metric", "Metric"],
            ["imperial", "Imperial"],
          ] as const
        ).map(([value, label]) => (
          <ChoiceChip
            key={value}
            selected={units === value}
            onClick={() => setUnits(value)}
          >
            {label}
          </ChoiceChip>
        ))}
      </ChoiceGroup>
      <FieldError>{fieldErrors.units}</FieldError>

      <label className="flex items-start gap-2.5 text-[14px] leading-snug text-muted-foreground">
        <input
          type="checkbox"
          checked={acceptTerms}
          onChange={(e) => setAcceptTerms(e.target.checked)}
          className="mt-0.5 size-4 rounded border-border accent-primary"
        />
        <span>
          I accept the Geoffit Terms of Use and Privacy Policy for my health
          account.
        </span>
      </label>
      <FieldError>{fieldErrors.acceptTerms}</FieldError>

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full text-[15px]"
      >
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  )
}
