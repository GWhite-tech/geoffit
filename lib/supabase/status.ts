import type { SupabaseClient } from "@supabase/supabase-js"

import { getSupabaseEnv } from "./env"

export type CloudConnectionStatus =
  | "not_configured"
  | "connected"
  | "unreachable"

export type CloudStatus = {
  connectionStatus: CloudConnectionStatus
  projectUrl: string | null
  environment: "Development" | "Production"
  authStatus: "Signed in" | "Signed out" | "Unknown"
  signedInEmail: string | null
  databaseReachable: boolean | null
  setupMessage: string | null
}

function detectEnvironment(): "Development" | "Production" {
  return process.env.NODE_ENV === "production" ? "Production" : "Development"
}

async function probeDatabase(url: string, anonKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      cache: "no-store",
    })
    // Any HTTP response from PostgREST means the project API is reachable.
    return response.status > 0 && response.status < 500
  } catch {
    return false
  }
}

export async function loadCloudStatus(
  supabase: SupabaseClient | null
): Promise<CloudStatus> {
  const { url, anonKey, isConfigured } = getSupabaseEnv()
  const environment = detectEnvironment()

  if (!isConfigured || !url || !anonKey) {
    return {
      connectionStatus: "not_configured",
      projectUrl: url,
      environment,
      authStatus: "Unknown",
      signedInEmail: null,
      databaseReachable: null,
      setupMessage:
        "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file, then restart the dev server. Use the anon (public) key only — never the service_role key.",
    }
  }

  if (!supabase) {
    return {
      connectionStatus: "unreachable",
      projectUrl: url,
      environment,
      authStatus: "Unknown",
      signedInEmail: null,
      databaseReachable: false,
      setupMessage: null,
    }
  }

  const databaseReachable = await probeDatabase(url, anonKey)

  let authStatus: CloudStatus["authStatus"] = "Signed out"
  let signedInEmail: string | null = null
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (!error && user) {
      authStatus = "Signed in"
      signedInEmail = user.email ?? user.id
    }
  } catch {
    authStatus = "Unknown"
  }

  return {
    connectionStatus: databaseReachable ? "connected" : "unreachable",
    projectUrl: url,
    environment,
    authStatus,
    signedInEmail,
    databaseReachable,
    setupMessage: null,
  }
}
