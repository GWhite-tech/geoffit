import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  requireCoachClientAccess,
  requireCoachClientRelationship,
} from "./access"

type Rel = {
  id: string
  coach_user_id: string
  client_user_id: string
  status: string
  permissions: string[]
  created_at?: string
}

function mockSupabase(options: {
  user: { id: string; email?: string } | null
  relationships?: Rel[]
  activeCoachCount?: number
}) {
  const relationships = options.relationships ?? []

  return {
    auth: {
      getUser: async () => ({
        data: { user: options.user },
        error: options.user ? null : { message: "no session" },
      }),
    },
    from(table: string) {
      assert.equal(table, "coach_client_relationships")
      const filters: Record<string, string> = {}
      let headCount = false
      const builder: Record<string, unknown> = {}

      const resolve = async () => {
        if (headCount) {
          return {
            data: null,
            error: null,
            count:
              options.activeCoachCount ??
              relationships.filter(
                (r) =>
                  r.coach_user_id === filters.coach_user_id &&
                  r.status === "active"
              ).length,
          }
        }
        let rows = relationships.filter((r) => {
          if (filters.coach_user_id && r.coach_user_id !== filters.coach_user_id) {
            return false
          }
          if (
            filters.client_user_id &&
            r.client_user_id !== filters.client_user_id
          ) {
            return false
          }
          if (filters.status && r.status !== filters.status) return false
          return true
        })
        rows = [...rows].sort((a, b) =>
          (b.created_at ?? "").localeCompare(a.created_at ?? "")
        )
        return { data: rows.slice(0, 5), error: null }
      }

      builder.select = (_cols: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.head) headCount = true
        return builder
      }
      builder.eq = (col: string, value: string) => {
        filters[col] = value
        return builder
      }
      builder.order = () => builder
      builder.limit = () => resolve()
      builder.then = (
        resolveFn: (v: unknown) => unknown,
        rejectFn?: (e: unknown) => unknown
      ) => Promise.resolve(resolve()).then(resolveFn, rejectFn)

      return builder
    },
  }
}

const COACH = "11111111-1111-4111-8111-111111111111"
const CLIENT_A = "22222222-2222-4222-8222-222222222222"
const CLIENT_B = "33333333-3333-4333-8333-333333333333"
const CLIENT_C = "44444444-4444-4444-8444-444444444444"

describe("requireCoachClientAccess", () => {
  it("rejects unauthenticated callers", async () => {
    const result = await requireCoachClientAccess(
      mockSupabase({ user: null }) as never,
      CLIENT_A,
      "vitals"
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, "unauthenticated")
  })

  it("rejects tampered / invalid clientId", async () => {
    const result = await requireCoachClientAccess(
      mockSupabase({ user: { id: COACH } }) as never,
      "not-a-uuid",
      "vitals"
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, "invalid_client")
  })

  it("rejects using the helper against the coach's own id", async () => {
    const result = await requireCoachClientAccess(
      mockSupabase({ user: { id: COACH } }) as never,
      COACH,
      "vitals"
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, "invalid_client")
  })

  it("allows coach to read authorised client data", async () => {
    const result = await requireCoachClientAccess(
      mockSupabase({
        user: { id: COACH },
        relationships: [
          {
            id: "rel-1",
            coach_user_id: COACH,
            client_user_id: CLIENT_A,
            status: "active",
            permissions: ["vitals", "sleep"],
          },
        ],
      }) as never,
      CLIENT_A,
      "vitals"
    )
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.clientUserId, CLIENT_A)
      assert.equal(result.coachUserId, COACH)
    }
  })

  it("denies unauthorised client", async () => {
    const result = await requireCoachClientAccess(
      mockSupabase({
        user: { id: COACH },
        relationships: [
          {
            id: "rel-1",
            coach_user_id: COACH,
            client_user_id: CLIENT_A,
            status: "active",
            permissions: ["vitals"],
          },
        ],
        activeCoachCount: 1,
      }) as never,
      CLIENT_B,
      "vitals"
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, "no_relationship")
  })

  it("denies access after revocation immediately", async () => {
    const result = await requireCoachClientAccess(
      mockSupabase({
        user: { id: COACH },
        relationships: [
          {
            id: "rel-1",
            coach_user_id: COACH,
            client_user_id: CLIENT_A,
            status: "revoked",
            permissions: ["vitals"],
          },
        ],
        activeCoachCount: 0,
      }) as never,
      CLIENT_A,
      "vitals"
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, "revoked")
  })

  it("denies blood when only training is granted", async () => {
    const result = await requireCoachClientAccess(
      mockSupabase({
        user: { id: COACH },
        relationships: [
          {
            id: "rel-1",
            coach_user_id: COACH,
            client_user_id: CLIENT_A,
            status: "active",
            permissions: ["training"],
          },
        ],
      }) as never,
      CLIENT_A,
      "blood"
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, "permission_denied")
  })

  it("denies training when only blood is granted", async () => {
    const result = await requireCoachClientAccess(
      mockSupabase({
        user: { id: COACH },
        relationships: [
          {
            id: "rel-1",
            coach_user_id: COACH,
            client_user_id: CLIENT_A,
            status: "active",
            permissions: ["blood"],
          },
        ],
      }) as never,
      CLIENT_A,
      "training"
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, "permission_denied")
  })

  it("supports one coach with multiple clients", async () => {
    const db = mockSupabase({
      user: { id: COACH },
      relationships: [
        {
          id: "rel-a",
          coach_user_id: COACH,
          client_user_id: CLIENT_A,
          status: "active",
          permissions: ["body"],
        },
        {
          id: "rel-b",
          coach_user_id: COACH,
          client_user_id: CLIENT_B,
          status: "active",
          permissions: ["body"],
        },
      ],
    })

    const a = await requireCoachClientAccess(db as never, CLIENT_A, "body")
    const b = await requireCoachClientAccess(db as never, CLIENT_B, "body")
    assert.equal(a.ok, true)
    assert.equal(b.ok, true)
  })

  it("supports one client with multiple coaches without cross-leak", async () => {
    const coach2 = "55555555-5555-4555-8555-555555555555"
    const forCoach1 = await requireCoachClientAccess(
      mockSupabase({
        user: { id: COACH },
        relationships: [
          {
            id: "rel-1",
            coach_user_id: COACH,
            client_user_id: CLIENT_C,
            status: "active",
            permissions: ["sleep"],
          },
        ],
      }) as never,
      CLIENT_C,
      "sleep"
    )
    const forCoach2Wrong = await requireCoachClientAccess(
      mockSupabase({
        user: { id: coach2 },
        relationships: [
          {
            id: "rel-1",
            coach_user_id: COACH,
            client_user_id: CLIENT_C,
            status: "active",
            permissions: ["sleep"],
          },
        ],
        activeCoachCount: 0,
      }) as never,
      CLIENT_C,
      "sleep"
    )
    assert.equal(forCoach1.ok, true)
    assert.equal(forCoach2Wrong.ok, false)
  })

  it("relationship helper returns granted permissions for filtering", async () => {
    const result = await requireCoachClientRelationship(
      mockSupabase({
        user: { id: COACH },
        relationships: [
          {
            id: "rel-1",
            coach_user_id: COACH,
            client_user_id: CLIENT_A,
            status: "active",
            permissions: ["vitals", "training"],
          },
        ],
      }) as never,
      CLIENT_A
    )
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.deepEqual(result.permissions, ["vitals", "training"])
    }
  })
})
