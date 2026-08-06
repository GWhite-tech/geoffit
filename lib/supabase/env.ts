/**
 * Public Supabase credentials — never the service_role key.
 */

export type SupabaseEnv = {
  url: string | null
  anonKey: string | null
  isConfigured: boolean
}

export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || null
  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey),
  }
}

export function requireSupabaseEnv(): { url: string; anonKey: string } {
  const { url, anonKey } = getSupabaseEnv()
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    )
  }
  return { url, anonKey }
}
