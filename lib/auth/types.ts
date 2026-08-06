import type { ThemePreference, UnitsSystem } from "@/lib/preferences/types"

export type { ThemePreference }
export type UnitsPreference = UnitsSystem

/** Identity profile — presentation prefs live in user_preferences. */
export type Profile = {
  id: string
  created_at: string
  updated_at: string
  display_name: string | null
  email: string | null
  date_of_birth: string | null
  sex_at_birth: string | null
  sex_for_ranges: string | null
  height_cm: number | null
  avatar_file_id: string | null
  deleted_at: string | null
  /** Convenience for UI that still splits display_name. */
  first_name: string
  last_name: string
  /** @deprecated use user_files / avatar_file_id — kept for current Avatar UI */
  avatar_url: string | null
}

export type RegisterInput = {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
  theme: ThemePreference
  units: UnitsPreference
  acceptTerms: boolean
}

export type LoginInput = {
  email: string
  password: string
  rememberMe: boolean
}

export type AuthActionResult =
  | { ok: true; redirectTo?: string; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
