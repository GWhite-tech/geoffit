import type { SupabaseClient } from "@supabase/supabase-js"

import type { Profile } from "./types"

export type ProfileInsert = {
  userId: string
  email: string
  firstName: string
  lastName: string
}

function displayName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ")
}

function splitDisplayName(name: string | null | undefined): {
  first_name: string
  last_name: string
} {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first_name: "", last_name: "" }
  if (parts.length === 1) return { first_name: parts[0]!, last_name: "" }
  return {
    first_name: parts[0]!,
    last_name: parts.slice(1).join(" "),
  }
}

export function mapProfileRow(row: Record<string, unknown>): Profile {
  const display =
    row.display_name == null ? null : String(row.display_name)
  const names = splitDisplayName(display)
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    display_name: display,
    email: row.email == null ? null : String(row.email),
    date_of_birth:
      row.date_of_birth == null ? null : String(row.date_of_birth),
    sex_at_birth:
      row.sex_at_birth == null ? null : String(row.sex_at_birth),
    sex_for_ranges:
      row.sex_for_ranges == null ? null : String(row.sex_for_ranges),
    height_cm:
      row.height_cm == null || row.height_cm === ""
        ? null
        : Number(row.height_cm),
    avatar_file_id:
      row.avatar_file_id == null ? null : String(row.avatar_file_id),
    deleted_at: row.deleted_at == null ? null : String(row.deleted_at),
    first_name: names.first_name,
    last_name: names.last_name,
    avatar_url: null,
  }
}

export async function fetchProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapProfileRow(data as Record<string, unknown>)
}

export async function createProfile(
  supabase: SupabaseClient,
  input: ProfileInsert
): Promise<Profile> {
  const first = input.firstName.trim()
  const last = input.lastName.trim()
  const row = {
    id: input.userId,
    display_name: displayName(first, last) || null,
    email: input.email.trim().toLowerCase(),
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .single()

  if (error) throw error
  return mapProfileRow(data as Record<string, unknown>)
}

export async function ensureProfile(
  supabase: SupabaseClient,
  input: ProfileInsert
): Promise<Profile> {
  const existing = await fetchProfile(supabase, input.userId)
  if (existing) return existing
  return createProfile(supabase, input)
}

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: Partial<
    Pick<
      Profile,
      | "display_name"
      | "email"
      | "date_of_birth"
      | "sex_at_birth"
      | "sex_for_ranges"
      | "height_cm"
      | "avatar_file_id"
    >
  > & {
    first_name?: string
    last_name?: string
  }
): Promise<Profile> {
  const next: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (patch.display_name !== undefined) {
    next.display_name = patch.display_name
  } else if (patch.first_name != null || patch.last_name != null) {
    next.display_name = displayName(
      patch.first_name ?? "",
      patch.last_name ?? ""
    )
  }

  if (patch.email !== undefined) next.email = patch.email
  if (patch.date_of_birth !== undefined) next.date_of_birth = patch.date_of_birth
  if (patch.sex_at_birth !== undefined) next.sex_at_birth = patch.sex_at_birth
  if (patch.sex_for_ranges !== undefined) {
    next.sex_for_ranges = patch.sex_for_ranges
  }
  if (patch.height_cm !== undefined) next.height_cm = patch.height_cm
  if (patch.avatar_file_id !== undefined) {
    next.avatar_file_id = patch.avatar_file_id
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(next)
    .eq("id", userId)
    .select("*")
    .single()

  if (error) throw error
  return mapProfileRow(data as Record<string, unknown>)
}

export function greetingName(profile: Profile | null | undefined): string {
  if (!profile) return "there"
  const first = profile.first_name?.trim()
  if (first) return first
  const display = profile.display_name?.trim()
  if (display) return display.split(/\s+/)[0] ?? display
  return "there"
}
