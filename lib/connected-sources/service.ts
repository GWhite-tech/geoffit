import { getLiveDataSources } from "@/lib/settings/settings-actions"

import { CONNECTED_SOURCE_CATALOG } from "./catalog"
import type {
  ConnectedSourceProvider,
  ConnectedSourceState,
  ConnectedSourceStatus,
  ConnectedSourceView,
} from "./types"

const COMING_SOON: ConnectedSourceProvider[] = [
  "withings",
  "cronometer",
  "myfitnesspal",
  "garmin",
  "polar",
  "whoop",
  "oura",
  "fitbit",
  "health_connect",
]

function mapLegacyStatus(
  status: string | undefined
): ConnectedSourceStatus {
  if (status === "connected") return "connected"
  if (status === "manual") return "manual"
  if (status === "coming_soon") return "coming_soon"
  return "disconnected"
}

/**
 * Build provider cards for Settings / onboarding.
 * Uses local import signals where available; placeholders otherwise.
 */
export function listConnectedSourceViews(): ConnectedSourceView[] {
  const live = getLiveDataSources()
  const byId = new Map(
    live.map((s) => {
      // Align legacy ids (apple-health → apple_health) if needed
      const normalized = s.id.replace(/-/g, "_")
      return [normalized, s] as const
    })
  )

  return CONNECTED_SOURCE_CATALOG.map((def) => {
    const legacy = byId.get(def.id) ?? byId.get(def.id.replace(/_/g, "-"))
    let state: ConnectedSourceState

    if (def.id === "manual") {
      state = {
        provider: def.id,
        status: "manual",
        lastSyncAt: legacy?.lastActivity ?? null,
        permissions: ["write"],
        errorMessage: null,
        healthOk: true,
        canSync: false,
        canDisconnect: false,
      }
    } else if (COMING_SOON.includes(def.id) && !legacy) {
      state = {
        provider: def.id,
        status: "coming_soon",
        lastSyncAt: null,
        permissions: [],
        errorMessage: null,
        healthOk: true,
        canSync: false,
        canDisconnect: false,
      }
    } else {
      const status = mapLegacyStatus(legacy?.status)
      const connected = status === "connected"
      state = {
        provider: def.id,
        status: COMING_SOON.includes(def.id) && !connected ? "coming_soon" : status,
        lastSyncAt: legacy?.lastActivity ?? null,
        permissions: connected ? ["read"] : [],
        errorMessage: null,
        healthOk: status !== "error",
        canSync:
          connected ||
          def.id === "apple_health" ||
          def.id === "csv" ||
          def.id === "hevy",
        canDisconnect: connected,
      }
    }

    return { ...def, ...state }
  })
}

export function getPrimaryConnectedSources(): ConnectedSourceView[] {
  return listConnectedSourceViews().filter((s) => s.primary)
}

export function summarizeConnectedSources() {
  const all = listConnectedSourceViews()
  const connected = all.filter(
    (s) => s.status === "connected" || s.status === "manual"
  )
  return {
    total: all.length,
    connected: connected.length,
    errors: all.filter((s) => s.status === "error").length,
    comingSoon: all.filter((s) => s.status === "coming_soon").length,
  }
}
