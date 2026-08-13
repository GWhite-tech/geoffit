import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  acceptCoachInvitation,
  createCoachInvitation,
  normalizeCoachEmail,
  parseAcceptInvitationToken,
  revokeCoachInvitation,
  revokeCoachRelationship,
} from "./invitations"
import { generateInvitationToken, hashInvitationToken } from "./token"

type InviteRow = {
  id: string
  client_user_id: string
  coach_email: string
  token_hash: string
  status: string
  permissions: string[]
  expires_at: string
  revoked_at?: string | null
}

function createInviteMock(options: {
  user: { id: string; email?: string } | null
  pending?: InviteRow[]
  onInsert?: (row: Record<string, unknown>) => { data: unknown; error: unknown }
  rpc?: (name: string, args: Record<string, unknown>) => Promise<{
    data: unknown
    error: { message: string } | null
  }>
  relationships?: Array<Record<string, unknown>>
}) {
  const pending = options.pending ?? []

  return {
    auth: {
      getUser: async () => ({
        data: { user: options.user },
        error: options.user ? null : { message: "no session" },
      }),
    },
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      if (name === "expire_stale_coach_invitations") {
        return { data: 0, error: null }
      }
      if (options.rpc) return options.rpc(name, args)
      return { data: null, error: { message: "invalid invitation" } }
    },
    from(table: string) {
      const state: {
        op: "insert" | "update" | "select"
        payload?: Record<string, unknown>
        filters: Record<string, string>
      } = { op: "select", filters: {} }

      const builder: Record<string, unknown> = {}
      builder.insert = (row: Record<string, unknown>) => {
        state.op = "insert"
        state.payload = row
        return builder
      }
      builder.update = (row: Record<string, unknown>) => {
        state.op = "update"
        state.payload = row
        return builder
      }
      builder.select = () => builder
      builder.eq = (col: string, value: string) => {
        state.filters[col] = value
        return builder
      }
      builder.or = () => builder
      builder.maybeSingle = async () => {
        if (table === "coach_invitations" && state.op === "update") {
          const row = pending.find(
            (p) =>
              p.id === state.filters.id &&
              p.client_user_id === state.filters.client_user_id &&
              p.status === "pending"
          )
          if (!row) return { data: null, error: null }
          row.status = String(state.payload?.status ?? "revoked")
          return { data: { id: row.id }, error: null }
        }
        if (table === "coach_client_relationships" && state.op === "update") {
          const id = state.filters.id
          const rel = (options.relationships ?? []).find((r) => r.id === id)
          if (!rel || rel.status !== "active") return { data: null, error: null }
          rel.status = "revoked"
          return { data: { id }, error: null }
        }
        if (table === "coach_client_relationships" && state.op === "select") {
          const rel = (options.relationships ?? []).find(
            (r) => r.id === state.filters.id
          )
          return { data: rel ?? null, error: null }
        }
        return { data: null, error: null }
      }
      builder.single = async () => {
        if (table !== "coach_invitations" || state.op !== "insert") {
          return { data: null, error: { message: "unexpected" } }
        }
        const row = state.payload!
        // Simulate unique pending constraint
        if (
          pending.some(
            (p) =>
              p.client_user_id === row.client_user_id &&
              p.coach_email === row.coach_email &&
              p.status === "pending"
          )
        ) {
          return {
            data: null,
            error: {
              code: "23505",
              message: "coach_invitations_pending_client_email_uq",
            },
          }
        }
        if (options.onInsert) return options.onInsert(row)
        const created: InviteRow = {
          id: "inv-1",
          client_user_id: String(row.client_user_id),
          coach_email: String(row.coach_email),
          token_hash: String(row.token_hash),
          status: "pending",
          permissions: row.permissions as string[],
          expires_at: String(row.expires_at),
        }
        pending.push(created)
        return {
          data: {
            id: created.id,
            coach_email: created.coach_email,
            permissions: created.permissions,
            expires_at: created.expires_at,
            status: created.status,
          },
          error: null,
        }
      }
      return builder
    },
  }
}

const CLIENT = "22222222-2222-4222-8222-222222222222"
const COACH = "11111111-1111-4111-8111-111111111111"

describe("coach invitations", () => {
  it("normalizes coach email consistently", () => {
    assert.equal(normalizeCoachEmail("  Coach@Example.COM "), "coach@example.com")
    assert.equal(normalizeCoachEmail("not-an-email"), null)
  })

  it("client can create invitation; raw token returned once; hash only persisted", async () => {
    let insertedHash: string | null = null
    const supabase = createInviteMock({
      user: { id: CLIENT, email: "client@example.com" },
      onInsert: (row) => {
        insertedHash = String(row.token_hash)
        assert.equal(row.status, "pending")
        assert.equal(typeof row.token, "undefined")
        return {
          data: {
            id: "inv-new",
            coach_email: row.coach_email,
            permissions: row.permissions,
            expires_at: row.expires_at,
            status: "pending",
          },
          error: null,
        }
      },
    })

    const result = await createCoachInvitation(supabase as never, {
      coachEmail: "Coach@Example.com",
      permissions: ["vitals", "sleep"],
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.ok(result.data.token.length >= 32)
      assert.equal(insertedHash, hashInvitationToken(result.data.token))
      assert.notEqual(insertedHash, result.data.token)
      assert.equal(
        Object.prototype.hasOwnProperty.call(result.data, "token_hash"),
        false
      )
      assert.equal(
        Object.prototype.hasOwnProperty.call(result.data, "tokenHash"),
        false
      )
    }
  })

  it("parseAcceptInvitationToken accepts only raw token field", () => {
    const raw = generateInvitationToken()
    const ok = parseAcceptInvitationToken({ token: raw })
    assert.equal(ok.ok, true)
    if (ok.ok) assert.equal(ok.data.token, raw)

    const viaHash = parseAcceptInvitationToken({
      token_hash: hashInvitationToken(raw),
    })
    assert.equal(viaHash.ok, false)

    const viaHashCamel = parseAcceptInvitationToken({
      tokenHash: hashInvitationToken(raw),
    })
    assert.equal(viaHashCamel.ok, false)

    const both = parseAcceptInvitationToken({
      token: raw,
      token_hash: hashInvitationToken(raw),
    })
    assert.equal(both.ok, false)

    const short = parseAcceptInvitationToken({ token: "short" })
    assert.equal(short.ok, false)
  })

  it("supplying stored token_hash as token does not accept", async () => {
    const raw = generateInvitationToken()
    const storedHash = hashInvitationToken(raw)
    let received: string | null = null
    const result = await acceptCoachInvitation(
      createInviteMock({
        user: { id: COACH, email: "coach@example.com" },
        rpc: async (_name, args) => {
          if (_name !== "accept_coach_invitation") {
            return { data: 0, error: null }
          }
          received = String(args.p_token_hash)
          if (received === storedHash) {
            return { data: "rel-leak", error: null }
          }
          return { data: null, error: { message: "invalid invitation" } }
        },
      }) as never,
      storedHash
    )
    assert.equal(result.ok, false)
    assert.equal(received, hashInvitationToken(storedHash))
    assert.notEqual(received, storedHash)
  })

  it("invalid raw token fails accept", async () => {
    const result = await acceptCoachInvitation(
      createInviteMock({
        user: { id: COACH, email: "coach@example.com" },
      }) as never,
      "not-a-valid-invitation-token-xx"
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, "not_found")
  })

  it("knowing coach email alone cannot accept (missing/short token)", async () => {
    const result = await acceptCoachInvitation(
      createInviteMock({
        user: { id: COACH, email: "coach@example.com" },
        rpc: async () => ({ data: "should-not-run", error: null }),
      }) as never,
      ""
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, "invalid_input")
  })

  it("rejects duplicate pending invitation for same client+email", async () => {
    const pending: InviteRow[] = [
      {
        id: "inv-1",
        client_user_id: CLIENT,
        coach_email: "coach@example.com",
        token_hash: "abc",
        status: "pending",
        permissions: ["vitals"],
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      },
    ]
    const result = await createCoachInvitation(
      createInviteMock({
        user: { id: CLIENT },
        pending,
      }) as never,
      { coachEmail: "coach@example.com", permissions: ["vitals"] }
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, "duplicate_pending")
  })

  it("allows a new invitation after prior revoked/expired/declined", async () => {
    const pending: InviteRow[] = [
      {
        id: "inv-old",
        client_user_id: CLIENT,
        coach_email: "coach@example.com",
        token_hash: "old",
        status: "revoked",
        permissions: ["vitals"],
        expires_at: new Date(Date.now() - 1000).toISOString(),
      },
    ]
    const result = await createCoachInvitation(
      createInviteMock({ user: { id: CLIENT }, pending }) as never,
      { coachEmail: "coach@example.com", permissions: ["body"] }
    )
    assert.equal(result.ok, true)
  })

  it("expired invitation cannot be accepted", async () => {
    const result = await acceptCoachInvitation(
      createInviteMock({
        user: { id: COACH, email: "coach@example.com" },
        rpc: async () => ({
          data: null,
          error: { message: "invitation expired" },
        }),
      }) as never,
      "a".repeat(40)
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, "expired")
  })

  it("revoked / non-pending invitation cannot be accepted", async () => {
    const result = await acceptCoachInvitation(
      createInviteMock({
        user: { id: COACH, email: "coach@example.com" },
        rpc: async () => ({
          data: null,
          error: { message: "invitation not pending" },
        }),
      }) as never,
      "b".repeat(40)
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, "not_pending")
  })

  it("accepted invitation creates active relationship", async () => {
    const result = await acceptCoachInvitation(
      createInviteMock({
        user: { id: COACH, email: "coach@example.com" },
        rpc: async (_name, args) => {
          assert.equal(typeof args.p_token_hash, "string")
          assert.match(String(args.p_token_hash), /^[a-f0-9]{64}$/)
          return { data: "rel-9", error: null }
        },
        relationships: [
          { id: "rel-9", client_user_id: CLIENT, status: "active" },
        ],
      }) as never,
      "c".repeat(40)
    )
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.data.relationshipId, "rel-9")
      assert.equal(result.data.clientUserId, CLIENT)
    }
  })

  it("invitation token is single-use (second accept fails)", async () => {
    let accepts = 0
    const supabase = createInviteMock({
      user: { id: COACH, email: "coach@example.com" },
      rpc: async () => {
        accepts += 1
        if (accepts === 1) return { data: "rel-1", error: null }
        return { data: null, error: { message: "invitation not pending" } }
      },
      relationships: [{ id: "rel-1", client_user_id: CLIENT }],
    })
    const first = await acceptCoachInvitation(supabase as never, "d".repeat(40))
    const second = await acceptCoachInvitation(supabase as never, "d".repeat(40))
    assert.equal(first.ok, true)
    assert.equal(second.ok, false)
    if (!second.ok) assert.equal(second.code, "not_pending")
  })

  it("email mismatch is opaque (no account leak)", async () => {
    const result = await acceptCoachInvitation(
      createInviteMock({
        user: { id: COACH, email: "other@example.com" },
        rpc: async () => ({
          data: null,
          error: { message: "invalid invitation" },
        }),
      }) as never,
      "e".repeat(40)
    )
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.code, "not_found")
      assert.equal(result.message.includes("email"), false)
      assert.equal(result.message.includes("account"), false)
    }
  })

  it("client can revoke invitation and relationship", async () => {
    const pending: InviteRow[] = [
      {
        id: "inv-1",
        client_user_id: CLIENT,
        coach_email: "coach@example.com",
        token_hash: "x",
        status: "pending",
        permissions: ["vitals"],
        expires_at: new Date(Date.now() + 10000).toISOString(),
      },
    ]
    const invitationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const relationshipId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    const inv = await revokeCoachInvitation(
      createInviteMock({
        user: { id: CLIENT },
        pending,
        rpc: async (name, args) => {
          assert.equal(name, "revoke_coach_invitation")
          assert.equal(args.p_invitation_id, invitationId)
          return { data: invitationId, error: null }
        },
      }) as never,
      invitationId
    )
    const rel = await revokeCoachRelationship(
      createInviteMock({
        user: { id: CLIENT },
        rpc: async (name, args) => {
          assert.equal(name, "revoke_coach_relationship")
          assert.equal(args.p_relationship_id, relationshipId)
          return { data: relationshipId, error: null }
        },
      }) as never,
      relationshipId
    )
    assert.equal(inv.ok, true)
    assert.equal(rel.ok, true)
    if (rel.ok) assert.equal(rel.data.relationshipId, relationshipId)
  })
})
