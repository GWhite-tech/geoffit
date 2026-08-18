import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { DEFAULT_AUTH_REDIRECT } from "./constants"
import {
  authCallbackUrlWithNext,
  authHrefWithNext,
  parseSafeAuthNext,
  resolveSafeAuthNext,
} from "./safe-next"

describe("parseSafeAuthNext / resolveSafeAuthNext", () => {
  it("preserves coach invitation accept return path with token", () => {
    const next = "/coaching/accept?token=raw-invite-token-value"
    assert.equal(parseSafeAuthNext(next), next)
    assert.equal(resolveSafeAuthNext(next), next)
  })

  it("defaults ordinary registration without next to mission control", () => {
    assert.equal(parseSafeAuthNext(null), null)
    assert.equal(parseSafeAuthNext(undefined), null)
    assert.equal(parseSafeAuthNext(""), null)
    assert.equal(parseSafeAuthNext("   "), null)
    assert.equal(resolveSafeAuthNext(null), DEFAULT_AUTH_REDIRECT)
    assert.equal(resolveSafeAuthNext(undefined), DEFAULT_AUTH_REDIRECT)
    assert.equal(resolveSafeAuthNext(""), DEFAULT_AUTH_REDIRECT)
  })

  it("rejects external and malicious next values", () => {
    const malicious = [
      "https://evil.example/phish",
      "http://evil.example",
      "//evil.example/phish",
      "///evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "https:evil.example",
      "/coaching/accept@evil.example",
      "/coaching/accept\n?token=x",
    ]

    for (const value of malicious) {
      assert.equal(
        parseSafeAuthNext(value),
        null,
        `expected reject: ${JSON.stringify(value)}`
      )
      assert.equal(
        resolveSafeAuthNext(value),
        DEFAULT_AUTH_REDIRECT,
        `expected fallback: ${JSON.stringify(value)}`
      )
    }
  })

  it("allows other relative app return paths used by middleware", () => {
    assert.equal(parseSafeAuthNext("/mission-control"), "/mission-control")
    assert.equal(parseSafeAuthNext("/coaching?tab=clients"), "/coaching?tab=clients")
    assert.equal(parseSafeAuthNext("/settings"), "/settings")
  })

  it("drops hash fragments from return paths", () => {
    assert.equal(
      parseSafeAuthNext("/coaching/accept?token=abc#section"),
      "/coaching/accept?token=abc"
    )
  })
})

describe("authHrefWithNext", () => {
  it("login → register preserves /coaching/accept?token=…", () => {
    const next = "/coaching/accept?token=raw-invite-token-value"
    assert.equal(
      authHrefWithNext("/register", next),
      `/register?next=${encodeURIComponent(next)}`
    )
    assert.equal(
      authHrefWithNext("/login", next),
      `/login?next=${encodeURIComponent(next)}`
    )
  })

  it("omits next when absent or unsafe", () => {
    assert.equal(authHrefWithNext("/register", null), "/register")
    assert.equal(authHrefWithNext("/register", "//evil.example"), "/register")
    assert.equal(authHrefWithNext("/login", "https://evil.example"), "/login")
  })
})

describe("authCallbackUrlWithNext", () => {
  it("email confirmation preserves the safe invitation return path", () => {
    const next = "/coaching/accept?token=raw-invite-token-value"
    const url = new URL(
      authCallbackUrlWithNext("https://geoffit.vercel.app", next)
    )
    assert.equal(url.origin, "https://geoffit.vercel.app")
    assert.equal(url.pathname, "/auth/callback")
    assert.equal(url.searchParams.get("next"), next)
  })

  it("email confirmation without next uses the default destination", () => {
    const url = new URL(
      authCallbackUrlWithNext("https://geoffit.vercel.app", null)
    )
    assert.equal(url.searchParams.get("next"), DEFAULT_AUTH_REDIRECT)
  })

  it("rejects malicious next in email confirmation callback URL", () => {
    const url = new URL(
      authCallbackUrlWithNext(
        "https://geoffit.vercel.app",
        "https://evil.example/phish"
      )
    )
    assert.equal(url.searchParams.get("next"), DEFAULT_AUTH_REDIRECT)
  })
})
