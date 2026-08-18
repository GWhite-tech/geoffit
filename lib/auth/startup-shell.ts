/**
 * Pure auth→shell gate decisions for authenticated startup.
 * Keeps profile loading off the shell critical path.
 */

import type { User } from "@supabase/supabase-js"

import { greetingName } from "./profile"
import type { Profile } from "./types"

export type AuthShellPhase =
  | "session_pending"
  | "authenticated"
  | "unauthenticated"
  | "unconfigured"

export type AuthShellInput = {
  configured: boolean
  /** True until getSession() has resolved (profile must not hold this). */
  sessionPending: boolean
  user: User | null
}

/** Decide whether the (app) shell may render. */
export function resolveAuthShellPhase(input: AuthShellInput): AuthShellPhase {
  if (!input.configured) return "unconfigured"
  if (input.sessionPending) return "session_pending"
  if (input.user) return "authenticated"
  return "unauthenticated"
}

/** Shell is allowed for unconfigured (local) and authenticated users. */
export function shouldRenderAppShell(phase: AuthShellPhase): boolean {
  return phase === "unconfigured" || phase === "authenticated" || phase === "session_pending"
}

/**
 * Header / greeting copy when profile may still be null.
 * Never throws; never requires a profiles row.
 */
export function resolveShellDisplayName(
  profile: Profile | null | undefined,
  user: User | null | undefined
): string {
  if (profile) {
    const fromProfile = greetingName(profile)
    if (fromProfile !== "there") return fromProfile
    if (profile.display_name?.trim()) {
      return profile.display_name.trim().split(/\s+/)[0] ?? profile.display_name.trim()
    }
  }

  const meta = user?.user_metadata ?? {}
  const first = String(meta.first_name ?? meta.firstName ?? "").trim()
  if (first) return first
  const full = String(meta.full_name ?? meta.name ?? "").trim()
  if (full) return full.split(/\s+/)[0] ?? full

  const email = (profile?.email ?? user?.email ?? "").trim()
  if (email.includes("@")) return email.split("@")[0] || "there"
  return "there"
}

export function resolveShellEmail(
  profile: Profile | null | undefined,
  user: User | null | undefined
): string {
  return (profile?.email ?? user?.email ?? "").trim()
}

export function resolveShellInitials(display: string, email: string): string {
  const parts = display.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
  }
  if (parts[0] && parts[0] !== "there") {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (email || "G").slice(0, 2).toUpperCase()
}
