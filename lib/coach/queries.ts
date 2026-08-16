/**
 * RLS-backed list queries for Coach UI (no new list HTTP APIs).
 * Selects only safe invitation columns (never token_hash).
 */

import type { CoachPermissionCategory } from "./categories"
import { normalizeCoachPermissions } from "./categories"

type QueryClient = {
  from: (table: string) => any
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>
  auth: {
    getUser: () => PromiseLike<{
      data: { user: { id: string; email?: string | null } | null }
      error: { message?: string } | null
    }>
  }
}

export type CoachInvitationRow = {
  id: string
  client_user_id: string
  coach_email: string
  coach_user_id: string | null
  status: string
  permissions: CoachPermissionCategory[]
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
  created_at: string
}

export type CoachRelationshipRow = {
  id: string
  coach_user_id: string
  client_user_id: string
  status: string
  permissions: CoachPermissionCategory[]
  invitation_id: string | null
  accepted_at: string | null
  revoked_at: string | null
  created_at: string
}

const INVITE_SAFE_COLUMNS =
  "id, client_user_id, coach_email, coach_user_id, status, permissions, expires_at, accepted_at, revoked_at, created_at"

function mapInvitation(row: Record<string, unknown>): CoachInvitationRow | null {
  const permissions = normalizeCoachPermissions(
    (row.permissions as string[]) ?? []
  )
  if (!permissions) return null
  return {
    id: String(row.id),
    client_user_id: String(row.client_user_id),
    coach_email: String(row.coach_email),
    coach_user_id: row.coach_user_id ? String(row.coach_user_id) : null,
    status: String(row.status),
    permissions,
    expires_at: String(row.expires_at),
    accepted_at: row.accepted_at ? String(row.accepted_at) : null,
    revoked_at: row.revoked_at ? String(row.revoked_at) : null,
    created_at: String(row.created_at),
  }
}

function mapRelationship(
  row: Record<string, unknown>
): CoachRelationshipRow | null {
  const permissions = normalizeCoachPermissions(
    (row.permissions as string[]) ?? []
  )
  if (!permissions) return null
  return {
    id: String(row.id),
    coach_user_id: String(row.coach_user_id),
    client_user_id: String(row.client_user_id),
    status: String(row.status),
    permissions,
    invitation_id: row.invitation_id ? String(row.invitation_id) : null,
    accepted_at: row.accepted_at ? String(row.accepted_at) : null,
    revoked_at: row.revoked_at ? String(row.revoked_at) : null,
    created_at: String(row.created_at),
  }
}

/** Invitations created by the current user (client view). */
export async function listClientInvitations(
  supabase: QueryClient
): Promise<{ ok: true; data: CoachInvitationRow[] } | { ok: false; error: string }> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return { ok: false, error: "Authentication required." }

  const { data, error } = await supabase
    .from("coach_invitations")
    .select(INVITE_SAFE_COLUMNS)
    .eq("client_user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return { ok: false, error: error.message ?? "Could not load invitations." }
  const rows = ((data ?? []) as Record<string, unknown>[])
    .map(mapInvitation)
    .filter((r): r is CoachInvitationRow => r != null)
  return { ok: true, data: rows }
}

/** Pending invitations addressed to the current coach email. */
export async function listInviteePendingInvitations(
  supabase: QueryClient
): Promise<{ ok: true; data: CoachInvitationRow[] } | { ok: false; error: string }> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return { ok: false, error: "Authentication required." }

  const { data, error } = await supabase
    .from("coach_invitations")
    .select(INVITE_SAFE_COLUMNS)
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (error) return { ok: false, error: error.message ?? "Could not load invitations." }
  const rows = ((data ?? []) as Record<string, unknown>[])
    .map(mapInvitation)
    .filter((r): r is CoachInvitationRow => r != null)
  return { ok: true, data: rows }
}

/** Active + recent relationships where the user is client or coach. */
export async function listParticipantRelationships(
  supabase: QueryClient
): Promise<
  { ok: true; data: CoachRelationshipRow[] } | { ok: false; error: string }
> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return { ok: false, error: "Authentication required." }

  const { data, error } = await supabase
    .from("coach_client_relationships")
    .select(
      "id, coach_user_id, client_user_id, status, permissions, invitation_id, accepted_at, revoked_at, created_at"
    )
    .order("created_at", { ascending: false })

  if (error) {
    return { ok: false, error: error.message ?? "Could not load relationships." }
  }
  const rows = ((data ?? []) as Record<string, unknown>[])
    .map(mapRelationship)
    .filter((r): r is CoachRelationshipRow => r != null)
  return { ok: true, data: rows }
}

export async function revokePendingInvitationRpc(
  supabase: QueryClient,
  invitationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc("revoke_coach_invitation", {
    p_invitation_id: invitationId,
  })
  if (error) return { ok: false, error: error.message ?? "Could not revoke invitation." }
  return { ok: true }
}

export async function fetchCoachVisibleClientProfile(
  supabase: QueryClient,
  clientId: string
): Promise<{ id: string; displayName: string | null } | null> {
  const { data, error } = await supabase.rpc("coach_visible_client_profile", {
    p_client_id: clientId,
  })
  if (error || !data) return null
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== "object") return null
  const id = String((row as { id?: unknown }).id ?? "")
  if (!id) return null
  const displayName = (row as { display_name?: unknown }).display_name
  return {
    id,
    displayName: typeof displayName === "string" ? displayName : null,
  }
}
