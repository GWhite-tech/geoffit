/**
 * Source wiring: profile must not hold auth loading; shell tolerates null profile.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const root = process.cwd()
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8")
}

describe("auth startup wiring", () => {
  it("AuthProvider clears loading after getSession, not after profile", () => {
    const src = read("components/auth/auth-provider.tsx")
    assert.ok(src.includes("getSession()"))
    assert.equal(
      src.includes("loadProfile(data.session?.user ?? null).finally"),
      false,
      "must not gate loading on loadProfile.finally"
    )
    const sessionBlock = src.slice(src.indexOf("getSession()"))
    const clearIdx = sessionBlock.indexOf("setLoading(false)")
    const profileCallIdx = sessionBlock.indexOf(
      "void loadProfile(data.session?.user ?? null)"
    )
    assert.ok(clearIdx >= 0, "getSession path must clear loading")
    assert.ok(profileCallIdx >= 0, "getSession path must start profile load")
    assert.ok(
      clearIdx < profileCallIdx,
      "loading must clear before background profile load"
    )
  })

  it("app layout renders AppShell for authenticated users without full-screen profile gate", () => {
    const layout = read("app/(app)/layout.tsx")
    assert.ok(layout.includes("AppShell"))
    assert.ok(layout.includes("resolveAuthShellPhase"))
    assert.equal(
      layout.includes("Loading Geoffit…"),
      false,
      "full-screen Loading Geoffit gate must be removed"
    )
    assert.ok(layout.includes("authenticated"))
  })

  it("header uses shell display helpers that tolerate null profile", () => {
    const header = read("components/layout/app-header.tsx")
    assert.ok(header.includes("resolveShellDisplayName"))
    assert.ok(header.includes("resolveShellEmail"))
  })

  it("useRequireAuth no longer treats missing user as perpetual loading after session", () => {
    const hook = read("hooks/auth/use-require-auth.ts")
    assert.equal(
      hook.includes("loading: loading || (configured && !user)"),
      false
    )
    assert.ok(hook.includes("resolveAuthShellPhase"))
    assert.ok(hook.includes('phase === "session_pending"'))
  })
})
