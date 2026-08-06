import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

import { getSupabaseEnv, requireSupabaseEnv } from "./env"

/**
 * Browser Supabase client (Client Components).
 *
 * `createBrowserClient` already maintains a singleton for the given URL/key —
 * calling this repeatedly returns the same instance.
 */
export function createClient(): SupabaseClient {
  const { url, anonKey } = requireSupabaseEnv()
  return createBrowserClient(url, anonKey)
}

/** Same singleton when configured; otherwise null (Settings / optional paths). */
export function createClientOrNull(): SupabaseClient | null {
  const { isConfigured } = getSupabaseEnv()
  if (!isConfigured) return null
  return createClient()
}
