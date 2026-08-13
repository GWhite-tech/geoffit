/**
 * Coach invitation create / accept / revoke (no email delivery).
 * Raw tokens exist only in the response/URL; DB stores token_hash.
 */

import {
  type CoachPermissionCategory,
  normalizeCoachPermissions,
} from "./categories"
import { generateInvitationToken, hashInvitationToken } from "./token"

/** Minimal surface used by invitation helpers (avoids loading supabase-js in tests). */
type InvitesSupabase = {
  auth: {
    getUser: () => PromiseLike<{
      data: { user: { id: string; email?: string | null } | null }
      error: { message?: string } | null
    }>
  }
  // Real client returns a thenable builder; mocks return a Promise.
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{
    data: unknown
    error: { message?: string; code?: string } | null
  }>
  from: (table: string) => any
}

const DEFAULT_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type InvitationErrorCode =
  | "unauthenticated"
  | "invalid_input"
  | "duplicate_pending"
  | "not_found"
  | "not_pending"
  | "expired"
  | "email_mismatch"
  | "forbidden"
  | "unknown"

export type InvitationResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: InvitationErrorCode; status: number; message: string }

export type CreatedInvitation = {
  invitationId: string
  /** Raw token — return once; never store. */
  token: string
  coachEmail: string
  permissions: CoachPermissionCategory[]
  expiresAt: string
  status: "pending"
}

export type AcceptedInvitation = {
  relationshipId: string
  clientUserId: string
}

export function normalizeCoachEmail(email: string): string | null {
  if (typeof email !== "string") return null
  const normalized = email.trim().toLowerCase()
  if (!normalized || !normalized.includes("@") || normalized.length > 320) {
    return null
  }
  return normalized
}

function fail(
  code: InvitationErrorCode,
  status: number,
  message: string
): InvitationResult<never> {
  return { ok: false, code, status, message }
}

export async function createCoachInvitation(
  supabase: InvitesSupabase,
  input: {
    coachEmail: string
    permissions: readonly string[]
    expiresInMs?: number
  }
): Promise<InvitationResult<CreatedInvitation>> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return fail("unauthenticated", 401, "Authentication required.")
  }

  const coachEmail = normalizeCoachEmail(input.coachEmail)
  if (!coachEmail) {
    return fail("invalid_input", 400, "Invalid coach email.")
  }

  if (user.email && normalizeCoachEmail(user.email) === coachEmail) {
    return fail("invalid_input", 400, "Cannot invite yourself.")
  }

  const permissions = normalizeCoachPermissions(input.permissions)
  if (!permissions) {
    return fail("invalid_input", 400, "Invalid permissions.")
  }

  const ttl =
    typeof input.expiresInMs === "number" && input.expiresInMs > 0
      ? input.expiresInMs
      : DEFAULT_INVITE_TTL_MS
  const expiresAt = new Date(Date.now() + ttl).toISOString()
  const token = generateInvitationToken()
  const tokenHash = hashInvitationToken(token)

  // Persist expiry of stale pending rows in its own statement so a later
  // failure cannot roll back the status change.
  await supabase.rpc("expire_stale_coach_invitations")

  const { data, error } = await supabase
    .from("coach_invitations")
    .insert({
      client_user_id: user.id,
      coach_email: coachEmail,
      token_hash: tokenHash,
      status: "pending",
      permissions,
      expires_at: expiresAt,
    })
    .select("id, coach_email, permissions, expires_at, status")
    .single()

  if (error) {
    const msg = (error.message ?? "").toLowerCase()
    if (
      error.code === "23505" ||
      msg.includes("duplicate") ||
      msg.includes("coach_invitations_pending_client_email")
    ) {
      return fail(
        "duplicate_pending",
        409,
        "A pending invitation already exists for this email."
      )
    }
    return fail("unknown", 500, "Could not create invitation.")
  }

  return {
    ok: true,
    data: {
      invitationId: data.id as string,
      token,
      coachEmail: data.coach_email as string,
      permissions: permissions,
      expiresAt: data.expires_at as string,
      status: "pending",
    },
  }
}

/**
 * Parse accept-invitation JSON body. Only the raw `token` is accepted.
 * `token_hash` / `tokenHash` are rejected so clients cannot bypass hashing.
 */
export function parseAcceptInvitationToken(
  body: unknown
): InvitationResult<{ token: string }> {
  if (typeof body !== "object" || body === null) {
    return fail("invalid_input", 400, "Invalid invitation.")
  }

  const record = body as Record<string, unknown>
  if ("token_hash" in record || "tokenHash" in record) {
    return fail("invalid_input", 400, "Invalid invitation.")
  }

  const token = typeof record.token === "string" ? record.token : ""
  if (token.trim().length < 16) {
    return fail("invalid_input", 400, "Invalid invitation.")
  }

  return { ok: true, data: { token: token.trim() } }
}

export async function acceptCoachInvitation(
  supabase: InvitesSupabase,
  rawToken: string
): Promise<InvitationResult<AcceptedInvitation>> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return fail("unauthenticated", 401, "Authentication required.")
  }

  if (typeof rawToken !== "string" || rawToken.trim().length < 16) {
    return fail("invalid_input", 400, "Invalid invitation.")
  }

  // Always hash the caller-supplied raw token. A stored digest submitted as
  // `token` will not match after hashing.
  const tokenHash = hashInvitationToken(rawToken.trim())

  // Commit expiry of stale invites before accept (accept RAISE would otherwise
  // roll back an in-function status update).
  await supabase.rpc("expire_stale_coach_invitations")

  const { data, error } = await supabase.rpc("accept_coach_invitation", {
    p_token_hash: tokenHash,
  })

  if (error) {
    const msg = (error.message ?? "").toLowerCase()
    if (msg.includes("authentication required")) {
      return fail("unauthenticated", 401, "Authentication required.")
    }
    if (msg.includes("expired")) {
      return fail("expired", 410, "Invitation is no longer valid.")
    }
    if (msg.includes("not pending")) {
      return fail("not_pending", 410, "Invitation is no longer valid.")
    }
    // Opaque: wrong token, email mismatch, self-accept, etc.
    return fail("not_found", 404, "Invitation is no longer valid.")
  }

  const relationshipId = data as string
  if (!relationshipId) {
    return fail("unknown", 500, "Could not accept invitation.")
  }

  const { data: rel, error: relError } = await supabase
    .from("coach_client_relationships")
    .select("id, client_user_id")
    .eq("id", relationshipId)
    .maybeSingle()

  if (relError || !rel) {
    return {
      ok: true,
      data: { relationshipId, clientUserId: "" },
    }
  }

  return {
    ok: true,
    data: {
      relationshipId: rel.id as string,
      clientUserId: rel.client_user_id as string,
    },
  }
}

export async function revokeCoachInvitation(
  supabase: InvitesSupabase,
  invitationId: string
): Promise<InvitationResult<{ invitationId: string }>> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return fail("unauthenticated", 401, "Authentication required.")
  }

  if (
    typeof invitationId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(invitationId)
  ) {
    return fail("invalid_input", 400, "Invalid invitation.")
  }

  const { data, error } = await supabase.rpc("revoke_coach_invitation", {
    p_invitation_id: invitationId,
  })

  if (error) {
    const msg = (error.message ?? "").toLowerCase()
    if (msg.includes("authentication required")) {
      return fail("unauthenticated", 401, "Authentication required.")
    }
    if (msg.includes("not pending") || msg.includes("not found")) {
      return fail("not_found", 404, "Invitation not found.")
    }
    return fail("unknown", 500, "Could not revoke invitation.")
  }

  if (!data) {
    return fail("not_found", 404, "Invitation not found.")
  }

  return { ok: true, data: { invitationId: data as string } }
}

export async function revokeCoachRelationship(
  supabase: InvitesSupabase,
  relationshipId: string
): Promise<InvitationResult<{ relationshipId: string }>> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return fail("unauthenticated", 401, "Authentication required.")
  }

  if (
    typeof relationshipId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(relationshipId)
  ) {
    return fail("invalid_input", 400, "Invalid relationship.")
  }

  const { data, error } = await supabase.rpc("revoke_coach_relationship", {
    p_relationship_id: relationshipId,
  })

  if (error) {
    const msg = (error.message ?? "").toLowerCase()
    if (msg.includes("authentication required")) {
      return fail("unauthenticated", 401, "Authentication required.")
    }
    if (msg.includes("not active") || msg.includes("not found")) {
      return fail("not_found", 404, "Relationship not found.")
    }
    return fail("unknown", 500, "Could not revoke relationship.")
  }

  if (!data) {
    return fail("not_found", 404, "Relationship not found.")
  }

  return { ok: true, data: { relationshipId: data as string } }
}
