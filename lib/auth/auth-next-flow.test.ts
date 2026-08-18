/**
 * Source-level regression: invite next must survive login → register →
 * email confirmation, and acceptance must still require the raw token.
 */
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const root = process.cwd()

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8")
}

function listTsx(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true })
    .flatMap((entry) => {
      const rel = join(dir, entry.name)
      if (entry.isDirectory()) return listTsx(rel)
      return entry.isFile() && entry.name.endsWith(".tsx") ? [rel] : []
    })
}

describe("auth next return-path wiring", () => {
  it("login → register preserves next via AuthNextLink + authHrefWithNext", () => {
    const login = read("app/(auth)/login/page.tsx")
    assert.ok(login.includes("AuthNextLink"))
    assert.ok(login.includes('href="/register"'))
    assert.equal(
      /<Link\s+href="\/register"/.test(login),
      false,
      "login must not hard-link /register without next"
    )

    const register = read("app/(auth)/register/page.tsx")
    assert.ok(register.includes("AuthNextLink"))
    assert.ok(register.includes('href="/login"'))
    assert.equal(
      /<Link\s+href="\/login"/.test(register),
      false,
      "register must not hard-link /login without next"
    )

    const link = read("components/auth/auth-next-link.tsx")
    assert.ok(link.includes("authHrefWithNext"))
    assert.ok(link.includes('searchParams.get("next")'))
  })

  it("register form passes next into registerAction", () => {
    const form = read("components/auth/register-form.tsx")
    assert.ok(form.includes("useSearchParams"))
    assert.ok(form.includes('searchParams.get("next")'))
    assert.ok(form.includes("next,"))
    assert.ok(form.includes("registerAction({"))
  })

  it("registerAction uses safe next for session redirect and email confirmation", () => {
    const actions = read("lib/auth/actions.ts")
    assert.ok(actions.includes("resolveSafeAuthNext"))
    assert.ok(actions.includes("authCallbackUrlWithNext"))
    assert.ok(actions.includes("input.next"))
    assert.ok(
      !actions.includes(
        'emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(DEFAULT_AUTH_REDIRECT)}`'
      )
    )
  })

  it("auth callback and login form use resolveSafeAuthNext", () => {
    const callback = read("app/auth/callback/route.ts")
    assert.ok(callback.includes("resolveSafeAuthNext"))
    assert.ok(
      !callback.includes(
        'nextParam.startsWith("/") && !nextParam.startsWith("//")'
      )
    )

    const loginForm = read("components/auth/login-form.tsx")
    assert.ok(loginForm.includes("resolveSafeAuthNext"))
  })

  it("invitation acceptance still requires the raw token (no auto-accept)", () => {
    const accept = read("components/coaching/accept-invitation-panel.tsx")
    assert.ok(
      accept.includes("postAcceptCoachInvitation({ token: parsed.token })")
    )
    assert.ok(accept.includes("Accept invitation"))
    assert.ok(!accept.includes("acceptCoachInvitation("))
    assert.ok(!/auto[- ]?accept/i.test(accept))

    // Pending list is display-only — no accept-by-id without token.
    assert.ok(!accept.includes("invitationId"))
    assert.ok(!accept.includes("invitation_id"))

    const api = read("lib/coach/client-api.ts")
    assert.ok(api.includes("body: JSON.stringify({ token: input.token })"))
    assert.ok(!api.includes("token_hash:"))
    assert.ok(!api.includes("tokenHash:"))

    for (const file of listTsx("components/coaching")) {
      const src = read(file)
      assert.equal(
        /token_hash\s*:/.test(src),
        false,
        `${file} must not send token_hash`
      )
    }
  })
})
