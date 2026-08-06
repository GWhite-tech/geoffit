import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { SupabaseClient } from "@supabase/supabase-js"

import { getSupabaseEnv, requireSupabaseEnv } from "./env"

/**
 * Server Supabase client (Server Components, Server Actions, Route Handlers).
 *
 * Creates a fresh client per call — required so each request reads its own
 * cookies. Do not cache across requests.
 */
export async function createClient(): Promise<SupabaseClient> {
  const { url, anonKey } = requireSupabaseEnv()
  const cookieStore = await cookies()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet, _headers) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Called from a Server Component where cookies are read-only.
          // Session refresh is handled by proxy.ts / updateSession.
        }
      },
    },
  })
}

export async function createClientOrNull(): Promise<SupabaseClient | null> {
  const { isConfigured } = getSupabaseEnv()
  if (!isConfigured) return null
  return createClient()
}
