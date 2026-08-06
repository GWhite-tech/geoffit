"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getSupabaseEnv } from "@/lib/supabase/env"

import {
  DEFAULT_AUTH_REDIRECT,
  MIN_PASSWORD_LENGTH,
  REMEMBER_ME_COOKIE,
  REMEMBER_ME_MAX_AGE_SECONDS,
  SESSION_ONLY_MAX_AGE_SECONDS,
} from "./constants"
import { toFriendlyAuthError } from "./errors"
import { ensureUserPreferences } from "@/lib/preferences/repository"
import { defaultUserPreferences } from "@/lib/preferences/types"

import { createProfile, ensureProfile } from "./profile"
import type {
  AuthActionResult,
  LoginInput,
  RegisterInput,
  ThemePreference,
  UnitsPreference,
} from "./types"

async function resolveOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? "http"
  if (host) return `${proto}://${host}`
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
}

function validateEmail(email: string): string | null {
  if (!email.trim()) return "Email is required."
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "Enter a valid email address."
  }
  return null
}

function validatePassword(password: string): string | null {
  if (!password) return "Password is required."
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  return null
}

async function setRememberCookie(rememberMe: boolean) {
  const jar = await cookies()
  jar.set(REMEMBER_ME_COOKIE, rememberMe ? "1" : "0", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: rememberMe
      ? REMEMBER_ME_MAX_AGE_SECONDS
      : SESSION_ONLY_MAX_AGE_SECONDS,
  })
}

export async function registerAction(
  input: RegisterInput
): Promise<AuthActionResult> {
  const { isConfigured } = getSupabaseEnv()
  if (!isConfigured) {
    return {
      ok: false,
      error:
        "Geoffit Cloud is not configured. Add Supabase environment variables to continue.",
    }
  }

  const fieldErrors: Record<string, string> = {}
  if (!input.firstName.trim()) fieldErrors.firstName = "First name is required."
  if (!input.lastName.trim()) fieldErrors.lastName = "Last name is required."
  const emailError = validateEmail(input.email)
  if (emailError) fieldErrors.email = emailError
  const passwordError = validatePassword(input.password)
  if (passwordError) fieldErrors.password = passwordError
  if (input.password !== input.confirmPassword) {
    fieldErrors.confirmPassword = "Passwords do not match."
  }
  if (!input.acceptTerms) {
    fieldErrors.acceptTerms = "Please accept the Terms to continue."
  }
  if (!["light", "dark", "system"].includes(input.theme)) {
    fieldErrors.theme = "Choose an appearance."
  }
  if (!["metric", "imperial"].includes(input.units)) {
    fieldErrors.units = "Choose a unit system."
  }
  if (Object.keys(fieldErrors).length) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors }
  }

  try {
    const supabase = await createClient()
    const origin = await resolveOrigin()
    const email = input.email.trim().toLowerCase()

    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(DEFAULT_AUTH_REDIRECT)}`,
        data: {
          first_name: input.firstName.trim(),
          last_name: input.lastName.trim(),
          theme: input.theme,
          units: input.units,
        },
      },
    })

    if (error) {
      return { ok: false, error: toFriendlyAuthError(error) }
    }

    const user = data.user
    if (!user) {
      return {
        ok: false,
        error: "Could not create your account. Please try again.",
      }
    }

    // Session present when email confirmation is disabled — create profile + go.
    if (data.session) {
      await setRememberCookie(true)
      try {
        await createProfile(supabase, {
          userId: user.id,
          email,
          firstName: input.firstName,
          lastName: input.lastName,
        })
        await ensureUserPreferences(
          supabase,
          user.id,
          defaultUserPreferences(user.id, {
            theme: input.theme as ThemePreference,
            units: input.units as UnitsPreference,
            show_welcome_screen: true,
          })
        )
      } catch (profileError) {
        console.error("profile/preferences create failed", profileError)
        return {
          ok: false,
          error:
            "Account created, but profile setup failed. Sign in and visit Account to retry — or apply the profiles + preferences migrations.",
        }
      }
      return { ok: true, redirectTo: DEFAULT_AUTH_REDIRECT }
    }

    // Email confirmation required — profile trigger (SQL) should still insert.
    return {
      ok: true,
      message:
        "Check your email to confirm your account, then sign in to continue.",
    }
  } catch (error) {
    return { ok: false, error: toFriendlyAuthError(error) }
  }
}

export async function loginAction(input: LoginInput): Promise<AuthActionResult> {
  const { isConfigured } = getSupabaseEnv()
  if (!isConfigured) {
    return {
      ok: false,
      error:
        "Geoffit Cloud is not configured. Add Supabase environment variables to continue.",
    }
  }

  const fieldErrors: Record<string, string> = {}
  const emailError = validateEmail(input.email)
  if (emailError) fieldErrors.email = emailError
  if (!input.password) fieldErrors.password = "Password is required."
  if (Object.keys(fieldErrors).length) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email.trim().toLowerCase(),
      password: input.password,
    })

    if (error) {
      return { ok: false, error: toFriendlyAuthError(error) }
    }

    if (!data.user) {
      return { ok: false, error: "Could not sign you in. Please try again." }
    }

    await setRememberCookie(input.rememberMe)

    const meta = data.user.user_metadata ?? {}
    try {
      await ensureProfile(supabase, {
        userId: data.user.id,
        email: data.user.email ?? input.email,
        firstName: String(meta.first_name ?? meta.firstName ?? "Geoffit"),
        lastName: String(meta.last_name ?? meta.lastName ?? "User"),
      })
      await ensureUserPreferences(
        supabase,
        data.user.id,
        defaultUserPreferences(data.user.id, {
          theme: (meta.theme as ThemePreference) ?? "system",
          units: (meta.units as UnitsPreference) ?? "metric",
        })
      )
    } catch (profileError) {
      console.error("ensure profile/preferences failed", profileError)
      // Still allow session, but cloud writes will self-heal via
      // ensureAuthenticatedProfile / ensure_own_profile RPC.
    }

    return { ok: true, redirectTo: DEFAULT_AUTH_REDIRECT }
  } catch (error) {
    return { ok: false, error: toFriendlyAuthError(error) }
  }
}

export async function logoutAction(): Promise<void> {
  const { isConfigured } = getSupabaseEnv()
  if (isConfigured) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }
  const jar = await cookies()
  jar.delete(REMEMBER_ME_COOKIE)
  redirect("/login")
}

export async function forgotPasswordAction(
  email: string
): Promise<AuthActionResult> {
  const { isConfigured } = getSupabaseEnv()
  if (!isConfigured) {
    return {
      ok: false,
      error: "Geoffit Cloud is not configured.",
    }
  }

  const emailError = validateEmail(email)
  if (emailError) {
    return { ok: false, error: emailError, fieldErrors: { email: emailError } }
  }

  try {
    const supabase = await createClient()
    const origin = await resolveOrigin()
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
      }
    )
    if (error) return { ok: false, error: toFriendlyAuthError(error) }

    // Always succeed generically to avoid account enumeration.
    return {
      ok: true,
      message:
        "If an account exists for that email, we sent a reset link. Check your inbox.",
    }
  } catch (error) {
    return { ok: false, error: toFriendlyAuthError(error) }
  }
}

export async function resetPasswordAction(
  password: string,
  confirmPassword: string
): Promise<AuthActionResult> {
  const { isConfigured } = getSupabaseEnv()
  if (!isConfigured) {
    return { ok: false, error: "Geoffit Cloud is not configured." }
  }

  const fieldErrors: Record<string, string> = {}
  const passwordError = validatePassword(password)
  if (passwordError) fieldErrors.password = passwordError
  if (password !== confirmPassword) {
    fieldErrors.confirmPassword = "Passwords do not match."
  }
  if (Object.keys(fieldErrors).length) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors }
  }

  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return {
        ok: false,
        error: "This password reset link has expired. Request a new one.",
      }
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { ok: false, error: toFriendlyAuthError(error) }

    return {
      ok: true,
      message: "Your password has been updated. You can continue to Geoffit.",
      redirectTo: DEFAULT_AUTH_REDIRECT,
    }
  } catch (error) {
    return { ok: false, error: toFriendlyAuthError(error) }
  }
}

export async function updatePasswordAction(
  password: string,
  confirmPassword: string
): Promise<AuthActionResult> {
  return resetPasswordAction(password, confirmPassword)
}
