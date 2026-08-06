import type { SupabaseClient } from "@supabase/supabase-js"

import { defaultUserPreferences } from "./types"
import type { UserPreferences, UserPreferencesPatch } from "./types"

function mapRow(row: Record<string, unknown>): UserPreferences {
  const base = defaultUserPreferences(String(row.user_id))
  return {
    ...base,
    id: String(row.id ?? row.user_id),
    user_id: String(row.user_id),
    theme: (row.theme as UserPreferences["theme"]) ?? base.theme,
    accent_colour: String(row.accent_colour ?? base.accent_colour),
    units: (row.units as UserPreferences["units"]) ?? base.units,
    timezone: String(row.timezone ?? base.timezone),
    locale: String(row.locale ?? base.locale),
    date_format: String(row.date_format ?? base.date_format),
    week_start: (row.week_start as UserPreferences["week_start"]) ?? base.week_start,
    default_dashboard: String(row.default_dashboard ?? base.default_dashboard),
    dashboard_layout:
      (row.dashboard_layout as UserPreferences["dashboard_layout"]) ??
      base.dashboard_layout,
    sidebar_collapsed: Boolean(row.sidebar_collapsed ?? base.sidebar_collapsed),
    show_welcome_screen: Boolean(
      row.show_welcome_screen ?? base.show_welcome_screen
    ),
    preferred_weight_unit:
      (row.preferred_weight_unit as UserPreferences["preferred_weight_unit"]) ??
      base.preferred_weight_unit,
    preferred_distance_unit:
      (row.preferred_distance_unit as UserPreferences["preferred_distance_unit"]) ??
      base.preferred_distance_unit,
    preferred_energy_unit:
      (row.preferred_energy_unit as UserPreferences["preferred_energy_unit"]) ??
      base.preferred_energy_unit,
    preferred_temperature_unit:
      (row.preferred_temperature_unit as UserPreferences["preferred_temperature_unit"]) ??
      base.preferred_temperature_unit,
    preferred_blood_glucose_unit:
      (row.preferred_blood_glucose_unit as UserPreferences["preferred_blood_glucose_unit"]) ??
      base.preferred_blood_glucose_unit,
    font_scaling:
      (row.font_scaling as UserPreferences["font_scaling"]) ?? base.font_scaling,
    density: (row.density as UserPreferences["density"]) ?? base.density,
    created_at: String(row.created_at ?? base.created_at),
    updated_at: String(row.updated_at ?? base.updated_at),
  }
}

function toRow(prefs: UserPreferences) {
  return {
    id: prefs.user_id,
    user_id: prefs.user_id,
    theme: prefs.theme,
    accent_colour: prefs.accent_colour,
    units: prefs.units,
    timezone: prefs.timezone,
    locale: prefs.locale,
    date_format: prefs.date_format,
    week_start: prefs.week_start,
    default_dashboard: prefs.default_dashboard,
    dashboard_layout: prefs.dashboard_layout,
    sidebar_collapsed: prefs.sidebar_collapsed,
    show_welcome_screen: prefs.show_welcome_screen,
    preferred_weight_unit: prefs.preferred_weight_unit,
    preferred_distance_unit: prefs.preferred_distance_unit,
    preferred_energy_unit: prefs.preferred_energy_unit,
    preferred_temperature_unit: prefs.preferred_temperature_unit,
    preferred_blood_glucose_unit: prefs.preferred_blood_glucose_unit,
    font_scaling: prefs.font_scaling,
    density: prefs.density,
    updated_at: new Date().toISOString(),
  }
}

export async function fetchUserPreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<UserPreferences | null> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function upsertUserPreferences(
  supabase: SupabaseClient,
  prefs: UserPreferences
): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from("user_preferences")
    .upsert(toRow(prefs), { onConflict: "user_id" })
    .select("*")
    .single()

  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function ensureUserPreferences(
  supabase: SupabaseClient,
  userId: string,
  seed?: Partial<UserPreferences>
): Promise<UserPreferences> {
  const existing = await fetchUserPreferences(supabase, userId)
  if (existing) return existing
  return upsertUserPreferences(
    supabase,
    defaultUserPreferences(userId, seed)
  )
}

export async function patchUserPreferences(
  supabase: SupabaseClient,
  userId: string,
  patch: UserPreferencesPatch
): Promise<UserPreferences> {
  const current =
    (await fetchUserPreferences(supabase, userId)) ??
    defaultUserPreferences(userId)
  return upsertUserPreferences(supabase, {
    ...current,
    ...patch,
    user_id: userId,
    id: userId,
    updated_at: new Date().toISOString(),
  })
}
