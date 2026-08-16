/**
 * Browser-safe Coach API helpers.
 * Never send token_hash / tokenHash. Never log raw invitation tokens.
 */

import type { MissionControlReadResponse } from "@/lib/cloud/reads/mission-control-dto"
import type { McTimeRange } from "@/lib/health/analytics/types"

import type { CoachPermissionCategory } from "./categories"

export type CreateInvitationResponse = {
  invitationId: string
  token: string
  coachEmail: string
  permissions: CoachPermissionCategory[]
  expiresAt: string
  status: "pending"
}

export type AcceptInvitationResponse = {
  relationshipId: string
  clientUserId: string
}

export type CoachMissionControlResponse = MissionControlReadResponse & {
  clientUserId: string
  grantedPermissions: CoachPermissionCategory[]
}

export type CoachApiError = {
  error: string
  code?: string
  status: number
}

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export async function postCreateCoachInvitation(input: {
  coachEmail: string
  permissions: readonly string[]
}): Promise<
  | { ok: true; data: CreateInvitationResponse }
  | { ok: false; error: CoachApiError }
> {
  const res = await fetch("/api/coach/invitations", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      coachEmail: input.coachEmail,
      permissions: [...input.permissions],
    }),
  })
  const json = (await parseJson(res)) as Record<string, unknown> | null
  if (!res.ok) {
    return {
      ok: false,
      error: {
        status: res.status,
        error:
          typeof json?.error === "string"
            ? json.error
            : "Could not create invitation.",
        code: typeof json?.code === "string" ? json.code : undefined,
      },
    }
  }
  return {
    ok: true,
    data: {
      invitationId: String(json?.invitationId ?? ""),
      token: String(json?.token ?? ""),
      coachEmail: String(json?.coachEmail ?? ""),
      permissions: (json?.permissions ?? []) as CoachPermissionCategory[],
      expiresAt: String(json?.expiresAt ?? ""),
      status: "pending",
    },
  }
}

/**
 * Accept invitation with the raw token only.
 * Rejects accidental token_hash / tokenHash fields before fetch.
 */
export async function postAcceptCoachInvitation(input: {
  token: string
}): Promise<
  | { ok: true; data: AcceptInvitationResponse }
  | { ok: false; error: CoachApiError }
> {
  const res = await fetch("/api/coach/invitations/accept", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ token: input.token }),
  })
  const json = (await parseJson(res)) as Record<string, unknown> | null
  if (!res.ok) {
    return {
      ok: false,
      error: {
        status: res.status,
        error:
          typeof json?.error === "string"
            ? json.error
            : "Could not accept invitation.",
        code: typeof json?.code === "string" ? json.code : undefined,
      },
    }
  }
  return {
    ok: true,
    data: {
      relationshipId: String(json?.relationshipId ?? ""),
      clientUserId: String(json?.clientUserId ?? ""),
    },
  }
}

export async function postRevokeCoachRelationship(
  relationshipId: string
): Promise<
  | { ok: true; data: { relationshipId: string; status: "revoked" } }
  | { ok: false; error: CoachApiError }
> {
  const res = await fetch(`/api/coach/relationships/${relationshipId}/revoke`, {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  })
  const json = (await parseJson(res)) as Record<string, unknown> | null
  if (!res.ok) {
    return {
      ok: false,
      error: {
        status: res.status,
        error:
          typeof json?.error === "string"
            ? json.error
            : "Could not revoke relationship.",
        code: typeof json?.code === "string" ? json.code : undefined,
      },
    }
  }
  return {
    ok: true,
    data: {
      relationshipId: String(json?.relationshipId ?? relationshipId),
      status: "revoked",
    },
  }
}

export async function fetchCoachMissionControl(
  clientId: string,
  bodyRange: McTimeRange = "90d"
): Promise<
  | { ok: true; data: CoachMissionControlResponse }
  | { ok: false; error: CoachApiError }
> {
  const params = new URLSearchParams({ bodyRange })
  const res = await fetch(
    `/api/coach/clients/${encodeURIComponent(clientId)}/reads/mission-control?${params}`,
    {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    }
  )
  const json = (await parseJson(res)) as Record<string, unknown> | null
  if (!res.ok) {
    return {
      ok: false,
      error: {
        status: res.status,
        error:
          typeof json?.error === "string"
            ? json.error
            : "Could not load client Mission Control.",
        code: typeof json?.code === "string" ? json.code : undefined,
      },
    }
  }
  return { ok: true, data: json as CoachMissionControlResponse }
}

/** Build accept URL; token lives only in the URL for handoff. */
export function buildCoachAcceptUrl(origin: string, rawToken: string): string {
  const url = new URL("/coaching/accept", origin)
  url.searchParams.set("token", rawToken)
  return url.toString()
}
