import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { generateInvitationToken, hashInvitationToken } from "./token"

describe("invitation tokens", () => {
  it("generates cryptographically strong opaque tokens", () => {
    const a = generateInvitationToken()
    const b = generateInvitationToken()
    assert.notEqual(a, b)
    assert.ok(a.length >= 32)
    assert.match(a, /^[A-Za-z0-9_-]+$/)
  })

  it("never uses the raw token as the stored hash", () => {
    const token = generateInvitationToken()
    const hash = hashInvitationToken(token)
    assert.notEqual(hash, token)
    assert.match(hash, /^[a-f0-9]{64}$/)
  })

  it("hashes deterministically (single-use acceptance keyed by hash)", () => {
    const token = "test-token-value-abcdefghijklmnopqrstuvwxyz"
    assert.equal(hashInvitationToken(token), hashInvitationToken(token))
    assert.notEqual(
      hashInvitationToken(token),
      hashInvitationToken(`${token}-tampered`)
    )
  })
})
