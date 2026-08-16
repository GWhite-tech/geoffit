import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"

import {
  acceptBodyContainsHashFields,
  buildAcceptInvitationBody,
  parseAcceptTokenFromSearchParams,
} from "./accept-token"
import { buildCoachAcceptUrl } from "./client-api"
import { allCoachPermissionCopy, coachPermissionCopy } from "./ui-labels"
import { COACH_PERMISSION_CATEGORIES } from "./categories"

const ROOT = process.cwd()

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

function listTsx(relDir: string): string[] {
  const dir = path.join(ROOT, relDir)
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => path.join(relDir, f))
}

describe("parseAcceptTokenFromSearchParams", () => {
  it("reads raw token from query", () => {
    const params = new URLSearchParams({
      token: "abcdefghijklmnopqrstuvwxyz012345",
    })
    const parsed = parseAcceptTokenFromSearchParams(params)
    assert.equal(parsed.ok, true)
    if (parsed.ok) assert.equal(parsed.token.length >= 16, true)
  })

  it("rejects token_hash query field", () => {
    const params = new URLSearchParams({
      token_hash: "abc",
      token: "abcdefghijklmnopqrstuvwxyz012345",
    })
    const parsed = parseAcceptTokenFromSearchParams(params)
    assert.deepEqual(parsed, { ok: false, reason: "hash_field" })
  })

  it("rejects tokenHash query field", () => {
    const params = new URLSearchParams({
      tokenHash: "abc",
    })
    const parsed = parseAcceptTokenFromSearchParams(params)
    assert.deepEqual(parsed, { ok: false, reason: "hash_field" })
  })

  it("rejects missing/short token", () => {
    assert.deepEqual(parseAcceptTokenFromSearchParams(new URLSearchParams()), {
      ok: false,
      reason: "missing",
    })
    assert.deepEqual(
      parseAcceptTokenFromSearchParams(new URLSearchParams({ token: "short" })),
      { ok: false, reason: "invalid" }
    )
  })
})

describe("accept body builders", () => {
  it("builds only token field", () => {
    const body = buildAcceptInvitationBody("abcdefghijklmnopqrstuvwxyz012345")
    assert.deepEqual(Object.keys(body), ["token"])
    assert.equal(acceptBodyContainsHashFields(body), false)
  })

  it("detects hash fields if present", () => {
    assert.equal(
      acceptBodyContainsHashFields({ token: "x", token_hash: "y" }),
      true
    )
    assert.equal(
      acceptBodyContainsHashFields({ token: "x", tokenHash: "y" }),
      true
    )
  })
})

describe("buildCoachAcceptUrl", () => {
  it("puts raw token in query and never includes hash keys", () => {
    const url = buildCoachAcceptUrl(
      "https://geoffit.vercel.app",
      "abcdefghijklmnopqrstuvwxyz012345"
    )
    const parsed = new URL(url)
    assert.equal(parsed.pathname, "/coaching/accept")
    assert.equal((parsed.searchParams.get("token")?.length ?? 0) >= 16, true)
    assert.equal(parsed.searchParams.has("token_hash"), false)
    assert.equal(parsed.searchParams.has("tokenHash"), false)
  })
})

describe("coach UI permission copy", () => {
  it("covers every backend category", () => {
    const copies = allCoachPermissionCopy()
    assert.equal(copies.length, COACH_PERMISSION_CATEGORIES.length)
    for (const category of COACH_PERMISSION_CATEGORIES) {
      const copy = coachPermissionCopy(category)
      assert.equal(copy.category, category)
      assert.ok(copy.label.length > 0)
      assert.ok(copy.description.length > 0)
    }
  })
})

describe("Coach UI routes and panels", () => {
  it("client can render Coach section (hub + My Coaches)", () => {
    assert.ok(fs.existsSync(path.join(ROOT, "app/(app)/coaching/page.tsx")))
    const hub = read("components/coaching/coaching-hub.tsx")
    assert.ok(hub.includes("MyCoachesPanel"))
    assert.ok(hub.includes("My Coaches"))
    const coaches = read("components/coaching/my-coaches-panel.tsx")
    assert.ok(coaches.includes("Invite a Coach"))
    assert.ok(coaches.includes("Active Coaches"))
    assert.ok(coaches.includes("Pending invitations"))
  })

  it("pending invitation renders email, permissions, revoke", () => {
    const src = read("components/coaching/my-coaches-panel.tsx")
    assert.ok(src.includes("Pending invitations"))
    assert.ok(src.includes("inv.coach_email"))
    assert.ok(src.includes("PermissionChips"))
    assert.ok(src.includes("Revoke invitation"))
    assert.ok(src.includes("revokePendingInvitationRpc"))
  })

  it("active Coach renders permissions and revoke relationship", () => {
    const src = read("components/coaching/my-coaches-panel.tsx")
    assert.ok(src.includes("Active Coaches"))
    assert.ok(src.includes("Revoke access"))
    assert.ok(src.includes("postRevokeCoachRelationship"))
  })

  it("revoke actions call the correct APIs", () => {
    const api = read("lib/coach/client-api.ts")
    assert.ok(api.includes("`/api/coach/relationships/${relationshipId}/revoke`"))
    const queries = read("lib/coach/queries.ts")
    assert.ok(queries.includes('rpc("revoke_coach_invitation"'))
    const coaches = read("components/coaching/my-coaches-panel.tsx")
    assert.ok(coaches.includes("postRevokeCoachRelationship(id)"))
    assert.ok(coaches.includes("revokePendingInvitationRpc(supabase, id)"))
  })

  it("Coach with zero clients gets empty state", () => {
    const src = read("components/coaching/my-clients-panel.tsx")
    assert.ok(src.includes("No clients yet"))
    assert.ok(src.includes("EmptyState"))
  })

  it("Coach with multiple clients can switch clients", () => {
    const src = read("components/coaching/my-clients-panel.tsx")
    assert.ok(src.includes("clients.length > 1"))
    assert.ok(src.includes("Select client"))
    assert.ok(src.includes("router.push(`/coaching/clients/${id}`)"))
    assert.ok(
      src.includes(
        "router.replace(`/coaching/clients/${options[0].relationship.client_user_id}`)"
      )
    )
  })

  it("changing client clears prior data before loading", () => {
    const src = read("components/coaching/coach-client-dashboard.tsx")
    assert.ok(src.includes("fetchGen"))
    assert.ok(src.includes("setData(null)"))
    assert.ok(src.includes("setDisplayName(null)"))
    assert.ok(src.includes("setLoading(true)"))
    assert.ok(src.includes("fetchCoachMissionControl(clientId"))
    assert.ok(!src.includes("/api/reads/mission-control"))
  })

  it("unauthorized categories use lock UI, not self-read APIs", () => {
    const dash = read("components/coaching/coach-client-dashboard.tsx")
    assert.ok(dash.includes("CategoryLockCard"))
    assert.ok(dash.includes('"locked"'))
    for (const file of listTsx("components/coaching")) {
      const src = read(file)
      assert.equal(
        src.includes("/api/reads/"),
        false,
        `${file} must not call self-read APIs`
      )
      assert.equal(
        src.includes("useMissionControl("),
        false,
        `${file} must not use self useMissionControl`
      )
    }
  })

  it("invitation acceptance sends raw token field only", () => {
    const api = read("lib/coach/client-api.ts")
    assert.ok(api.includes('body: JSON.stringify({ token: input.token })'))
    assert.ok(!api.includes("token_hash:"))
    assert.ok(!api.includes("tokenHash:"))
    const accept = read("components/coaching/accept-invitation-panel.tsx")
    assert.ok(accept.includes("postAcceptCoachInvitation({ token: parsed.token })"))
    assert.ok(!accept.includes("token_hash"))
    assert.ok(!accept.includes("tokenHash"))
  })

  it("token_hash/tokenHash is never sent by the UI", () => {
    for (const file of [
      ...listTsx("components/coaching"),
      "lib/coach/client-api.ts",
      "lib/coach/accept-token.ts",
      "lib/coach/queries.ts",
    ]) {
      const src = read(file)
      assert.equal(
        /token_hash\s*:/.test(src),
        false,
        `${file} must not send token_hash`
      )
      assert.equal(
        /tokenHash\s*:/.test(src),
        false,
        `${file} must not send tokenHash`
      )
    }
    const queries = read("lib/coach/queries.ts")
    assert.ok(queries.includes("INVITE_SAFE_COLUMNS"))
    // Safe column list must omit hash; comments may mention token_hash.
    assert.ok(!/,?\s*token_hash\s*,?/.test(queries.split("INVITE_SAFE_COLUMNS")[1] ?? ""))
    const cols = queries.match(
      /const INVITE_SAFE_COLUMNS =\s*\n?\s*"([^"]+)"/
    )?.[1]
    assert.ok(cols)
    assert.ok(!cols!.includes("token_hash"))
  })

  it("Coach Mission Control is isolated from self-read namespace", () => {
    const coachRoute = read(
      "app/api/coach/clients/[clientId]/reads/mission-control/route.ts"
    )
    assert.ok(coachRoute.includes("fetchMissionControlRead"))
    assert.ok(coachRoute.includes("requireCoachClientRelationship"))
    assert.ok(coachRoute.includes("access.clientUserId"))
    assert.ok(coachRoute.includes('url.searchParams.has("userId")'))

    // Self-read BFF may land in a separate cloud-read release; when absent,
    // coach isolation is still guaranteed by the /api/coach namespace.
    // When present (e.g. local WIP), it must not accept arbitrary clientId.
    const selfReadPath = path.join(
      ROOT,
      "app/api/reads/mission-control/route.ts"
    )
    if (!fs.existsSync(selfReadPath)) {
      for (const file of listTsx("components/coaching")) {
        const src = read(file)
        assert.equal(
          src.includes("/api/reads/"),
          false,
          `${file} must not call self-read APIs`
        )
      }
      const api = read("lib/coach/client-api.ts")
      assert.ok(
        api.includes(
          "`/api/coach/clients/${encodeURIComponent(clientId)}/reads/mission-control"
        )
      )
      assert.equal(api.includes("/api/reads/"), false)
      return
    }

    const selfRoute = fs.readFileSync(selfReadPath, "utf8")
    assert.ok(selfRoute.includes("user.id"))
    assert.equal(selfRoute.includes("clientId"), false)
    assert.ok(!selfRoute.includes("requireCoachClientRelationship"))
    assert.ok(selfRoute.includes('url.searchParams.has("userId")'))
  })

  it("nav exposes Coaching entry under authenticated app", () => {
    const nav = read("lib/dashboard-data.ts")
    assert.ok(nav.includes('label: "Coaching"'))
    assert.ok(nav.includes('href: "/coaching"'))
  })
})
