/**
 * Server-side coach↔client authorisation.
 * Never trust a client-supplied clientId without this check.
 */

import {
  type CoachPermissionCategory,
  isCoachPermissionCategory,
  normalizeCoachPermissions,
  permissionsInclude,
} from "./categories"

/** Minimal surface used by access helpers (avoids loading supabase-js in tests). */
type AccessSupabase = {
  auth: {
    getUser: () => PromiseLike<{
      data: { user: { id: string } | null }
      error: { message?: string } | null
    }>
  }
  from: (table: string) => any
}

export type CoachAccessErrorCode =
  | "unauthenticated"
  | "not_a_coach"
  | "no_relationship"
  | "revoked"
  | "permission_denied"
  | "invalid_category"
  | "invalid_client"

export type CoachAccessDenied = {
  ok: false
  code: CoachAccessErrorCode
  /** Safe HTTP status for API responses. */
  status: 400 | 401 | 403
  /** Safe, non-leaky message for clients. */
  message: string
}

export type CoachAccessGranted = {
  ok: true
  coachUserId: string
  clientUserId: string
  relationshipId: string
  permissions: CoachPermissionCategory[]
  status: "active"
}

export type CoachAccessResult = CoachAccessGranted | CoachAccessDenied

type RelationshipRow = {
  id: string
  coach_user_id: string
  client_user_id: string
  status: string
  permissions: string[] | null
}

function denied(
  code: CoachAccessErrorCode,
  status: 400 | 401 | 403,
  message: string
): CoachAccessDenied {
  return { ok: false, code, status, message }
}

/**
 * Authenticate the current user and verify an active coach relationship
 * with the requested category grant(s).
 *
 * When `category` is an array, every listed category must be granted.
 */
export async function requireCoachClientAccess(
  supabase: AccessSupabase,
  clientUserId: string,
  category: CoachPermissionCategory | readonly CoachPermissionCategory[]
): Promise<CoachAccessResult> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return denied("unauthenticated", 401, "Authentication required.")
  }

  if (
    typeof clientUserId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(clientUserId)
  ) {
    return denied("invalid_client", 400, "Invalid client.")
  }

  if (clientUserId === user.id) {
    return denied("invalid_client", 400, "Invalid client.")
  }

  const required = Array.isArray(category) ? [...category] : [category]
  for (const c of required) {
    if (!isCoachPermissionCategory(c)) {
      return denied("invalid_category", 400, "Invalid permission category.")
    }
  }

  const { data, error } = await supabase
    .from("coach_client_relationships")
    .select("id, coach_user_id, client_user_id, status, permissions")
    .eq("coach_user_id", user.id)
    .eq("client_user_id", clientUserId)
    .order("created_at", { ascending: false })
    .limit(5)

  if (error) {
    return denied("no_relationship", 403, "Access denied.")
  }

  const rows = (data ?? []) as RelationshipRow[]
  const active = rows.find((r) => r.status === "active")
  if (!active) {
    if (rows.some((r) => r.status === "revoked")) {
      return denied("revoked", 403, "Access denied.")
    }

    // Distinguish "not a coach for anyone" vs "no relationship with this client".
    const { count, error: countError } = await supabase
      .from("coach_client_relationships")
      .select("id", { count: "exact", head: true })
      .eq("coach_user_id", user.id)
      .eq("status", "active")

    if (!countError && (count ?? 0) === 0) {
      return denied("not_a_coach", 403, "Access denied.")
    }
    return denied("no_relationship", 403, "Access denied.")
  }

  const permissions = normalizeCoachPermissions(active.permissions ?? [])
  if (!permissions) {
    return denied("permission_denied", 403, "Access denied.")
  }

  if (!permissionsInclude(permissions, required)) {
    return denied("permission_denied", 403, "Access denied.")
  }

  return {
    ok: true,
    coachUserId: user.id,
    clientUserId,
    relationshipId: active.id,
    permissions,
    status: "active",
  }
}

/**
 * Active relationship only (any permissions). Used by multi-domain reads
 * that filter domains by granted categories after authz.
 */
export async function requireCoachClientRelationship(
  supabase: AccessSupabase,
  clientUserId: string
): Promise<CoachAccessResult> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return denied("unauthenticated", 401, "Authentication required.")
  }

  if (
    typeof clientUserId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(clientUserId)
  ) {
    return denied("invalid_client", 400, "Invalid client.")
  }

  if (clientUserId === user.id) {
    return denied("invalid_client", 400, "Invalid client.")
  }

  const { data, error } = await supabase
    .from("coach_client_relationships")
    .select("id, coach_user_id, client_user_id, status, permissions")
    .eq("coach_user_id", user.id)
    .eq("client_user_id", clientUserId)
    .order("created_at", { ascending: false })
    .limit(5)

  if (error) {
    return denied("no_relationship", 403, "Access denied.")
  }

  const rows = (data ?? []) as RelationshipRow[]
  const active = rows.find((r) => r.status === "active")
  if (!active) {
    if (rows.some((r) => r.status === "revoked")) {
      return denied("revoked", 403, "Access denied.")
    }
    const { count, error: countError } = await supabase
      .from("coach_client_relationships")
      .select("id", { count: "exact", head: true })
      .eq("coach_user_id", user.id)
      .eq("status", "active")

    if (!countError && (count ?? 0) === 0) {
      return denied("not_a_coach", 403, "Access denied.")
    }
    return denied("no_relationship", 403, "Access denied.")
  }

  const permissions = normalizeCoachPermissions(active.permissions ?? [])
  if (!permissions) {
    return denied("permission_denied", 403, "Access denied.")
  }

  return {
    ok: true,
    coachUserId: user.id,
    clientUserId,
    relationshipId: active.id,
    permissions,
    status: "active",
  }
}
