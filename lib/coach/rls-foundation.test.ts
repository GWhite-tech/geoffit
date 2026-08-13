/**
 * Static security review of the Phase 1 coach migration + coach API routes.
 * Complements application-level authorisation tests (no live DB in CI).
 */

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"

function readSrc(...parts: string[]): string {
  return readFileSync(path.join(process.cwd(), ...parts), "utf8")
}

const migration = () =>
  readSrc("supabase/migrations/20260813120000_coach_client_foundation.sql")

describe("coach RLS / schema foundation", () => {
  it("creates invitations + relationships with pending/active uniqueness", () => {
    const sql = migration()
    assert.ok(sql.includes("create table if not exists public.coach_invitations"))
    assert.ok(
      sql.includes("create table if not exists public.coach_client_relationships")
    )
    assert.ok(sql.includes("coach_invitations_pending_client_email_uq"))
    assert.ok(sql.includes("coach_client_relationships_active_pair_uq"))
    assert.ok(sql.includes("token_hash text not null"))
    assert.equal(sql.includes("raw_token"), false)
    assert.equal(/\btoken\s+text\b/.test(sql), false)
  })

  it("defines can_coach_read with locked search_path", () => {
    const sql = migration()
    assert.ok(sql.includes("create or replace function public.can_coach_read"))
    assert.ok(sql.includes("security definer"))
    assert.ok(sql.includes("set search_path = public"))
    assert.ok(sql.includes("r.status = 'active'"))
    assert.ok(sql.includes("p_category = any (r.permissions)"))
  })

  it("maps health_records metric types before granting coach SELECT", () => {
    const sql = migration()
    assert.ok(sql.includes("health_records_select_coach"))
    assert.ok(sql.includes("coach_category_for_metric(metric_type)"))
    for (const metric of [
      "heart_rate",
      "sleep_analysis",
      "body_mass",
      "dietary_energy",
      "workout",
    ]) {
      assert.ok(sql.includes(`when '${metric}' then`))
    }
  })

  it("adds SELECT-only coach policies on fact tables (no write policies)", () => {
    const sql = migration()
    const selectPolicies = [
      "health_records_select_coach",
      "blood_panels_select_coach",
      "blood_results_select_coach",
      "workouts_select_coach",
      "nutrition_days_select_coach",
      "treatments_select_coach",
      "treatment_lots_select_coach",
      "treatment_dose_events_select_coach",
    ]
    for (const name of selectPolicies) {
      assert.ok(sql.includes(name), `missing ${name}`)
      assert.ok(
        sql.includes(`create policy ${name}`) &&
          sql.includes("for select to authenticated"),
        `${name} must be SELECT`
      )
    }
    assert.equal(sql.includes("health_records_insert_coach"), false)
    assert.equal(sql.includes("health_records_update_coach"), false)
    assert.equal(sql.includes("health_records_delete_coach"), false)
    assert.equal(sql.includes("for insert to authenticated\n  with check (\n    deleted_at"), false)
  })

  it("does not create org/workspace/notes tables", () => {
    const sql = migration()
    assert.equal(sql.includes("organisation"), false)
    assert.equal(sql.includes("organization"), false)
    assert.equal(sql.includes("coach_notes"), false)
    assert.equal(sql.includes("workspace"), false)
    assert.equal(sql.includes("create table if not exists public.coach_profiles"), false)
  })

  it("accept RPC enforces pending/expiry/email match and opaque errors", () => {
    const sql = migration()
    assert.ok(sql.includes("accept_coach_invitation"))
    assert.ok(sql.includes("v_inv.status <> 'pending'"))
    assert.ok(sql.includes("v_inv.expires_at <= now()"))
    assert.ok(sql.includes("v_inv.coach_email <> v_email"))
    assert.ok(sql.includes("raise exception 'invalid invitation'"))
  })

  it("mutates invitations/relationships only via SECURITY DEFINER RPCs", () => {
    const sql = migration()
    assert.equal(sql.includes("coach_client_relationships_insert"), false)
    assert.equal(sql.includes("coach_invitations_revoke_as_client"), false)
    assert.ok(sql.includes("grant select on public.coach_client_relationships"))
    assert.ok(sql.includes("grant select, insert on public.coach_invitations"))
    assert.ok(sql.includes("revoke_coach_relationship"))
    assert.ok(sql.includes("revoke_coach_invitation"))
    assert.ok(sql.includes("accept_coach_invitation"))
  })

  it("includes fact-table grants and invitation expiry helper migrations", () => {
    const grants = readSrc(
      "supabase/migrations/20260813130000_cloud_fact_authenticated_grants.sql"
    )
    const expiry = readSrc(
      "supabase/migrations/20260813140000_coach_invitation_expiry_fix.sql"
    )
    assert.ok(grants.includes("grant select, insert, update, delete on public.health_records"))
    assert.ok(expiry.includes("expire_stale_coach_invitations"))
    assert.ok(
      readSrc("lib/coach/invitations.ts").includes("expire_stale_coach_invitations")
    )
  })

  it("revokes authenticated SELECT on token_hash while preserving insert", () => {
    const privacy = readSrc(
      "supabase/migrations/20260813150000_coach_invitation_token_privacy.sql"
    )
    assert.ok(
      privacy.includes(
        "revoke select on table public.coach_invitations from authenticated"
      )
    )
    const selectGrant = privacy.match(
      /grant select \(([\s\S]*?)\) on table public\.coach_invitations to authenticated;/
    )
    assert.ok(selectGrant)
    assert.equal(selectGrant![1].includes("token_hash"), false)
    assert.ok(selectGrant![1].includes("coach_email"))
    assert.ok(selectGrant![1].includes("permissions"))
    assert.ok(
      privacy.includes(
        "grant insert on table public.coach_invitations to authenticated"
      )
    )
    assert.ok(
      privacy.includes(
        "grant insert (token_hash) on table public.coach_invitations to authenticated"
      )
    )
    assert.equal(privacy.includes("drop policy"), false)
    assert.equal(privacy.includes("create policy"), false)
    assert.ok(
      readSrc("scripts/verify-coach-rls-local.sql").includes(
        "invitee cannot SELECT token_hash"
      )
    )
  })

  it("accept API hashes raw token server-side and rejects token_hash body fields", () => {
    const route = readSrc("app/api/coach/invitations/accept/route.ts")
    const invitations = readSrc("lib/coach/invitations.ts")
    assert.ok(route.includes("parseAcceptInvitationToken"))
    assert.ok(invitations.includes("parseAcceptInvitationToken"))
    assert.ok(invitations.includes('"token_hash" in record'))
    assert.ok(invitations.includes("hashInvitationToken(rawToken.trim())"))
    assert.ok(invitations.includes("p_token_hash: tokenHash"))
    const createRoute = readSrc("app/api/coach/invitations/route.ts")
    assert.ok(createRoute.includes("token: result.data.token"))
    assert.equal(createRoute.includes("tokenHash"), false)
    assert.equal(/token_hash\s*:/.test(createRoute), false)
    assert.equal(route.includes("token_hash:"), false)
    assert.equal(route.includes("p_token_hash"), false)
  })

  it("narrows coach-visible profile fields", () => {
    const sql = migration()
    assert.ok(sql.includes("coach_visible_client_profile"))
    assert.ok(sql.includes("returns table (id uuid, display_name text)"))
    assert.equal(sql.includes("date_of_birth"), false)
  })
})

describe("coach API foundation source guarantees", () => {
  it("keeps coach reads under /api/coach/clients/:clientId", () => {
    const route = readSrc(
      "app/api/coach/clients/[clientId]/reads/mission-control/route.ts"
    )
    assert.ok(route.includes("requireCoachClientRelationship"))
    assert.ok(route.includes("fetchMissionControlRead"))
    assert.ok(route.includes("access.clientUserId"))
    assert.ok(route.includes('url.searchParams.has("userId")'))
    assert.ok(route.includes("filterMissionControlForCoach"))
    assert.equal(route.includes("indexedDB"), false)
    assert.equal(route.includes("localStorage"), false)
  })

  it("does not add clientId to existing /api/reads/mission-control", () => {
    const selfReadPath = path.join(
      process.cwd(),
      "app/api/reads/mission-control/route.ts"
    )
    // Self-read BFF may land in a separate cloud-read release; when absent,
    // coach isolation is still guaranteed by the /api/coach namespace.
    if (!existsSync(selfReadPath)) {
      const coach = readSrc(
        "app/api/coach/clients/[clientId]/reads/mission-control/route.ts"
      )
      assert.ok(coach.includes("/api/coach") || coach.includes("requireCoachClientRelationship"))
      assert.ok(coach.includes("access.clientUserId"))
      return
    }
    const selfRead = readFileSync(selfReadPath, "utf8")
    assert.ok(selfRead.includes("user.id"))
    assert.equal(selfRead.includes("clientId"), false)
    assert.ok(selfRead.includes('url.searchParams.has("userId")'))
  })

  it("invitation create returns token once and never writes raw token column", () => {
    const create = readSrc("lib/coach/invitations.ts")
    assert.ok(create.includes("token_hash: tokenHash"))
    assert.ok(create.includes("generateInvitationToken"))
    assert.ok(create.includes("hashInvitationToken"))
    assert.equal(create.includes("token: token,"), false)
    assert.ok(create.includes("accept_coach_invitation"))
  })
})
