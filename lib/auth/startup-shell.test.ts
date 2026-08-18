import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { User } from "@supabase/supabase-js"

import type { Profile } from "./types"
import {
  resolveAuthShellPhase,
  resolveShellDisplayName,
  resolveShellEmail,
  resolveShellInitials,
  shouldRenderAppShell,
} from "./startup-shell"

function fakeUser(overrides: Partial<User> & { email?: string } = {}): User {
  return {
    id: "user-1",
    email: overrides.email ?? "coach@example.com",
    app_metadata: {},
    user_metadata: overrides.user_metadata ?? {
      first_name: "Matt",
      last_name: "Kingston",
    },
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as User
}

function fakeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    display_name: "Matt Kingston",
    email: "coach@example.com",
    date_of_birth: null,
    sex_at_birth: null,
    sex_for_ranges: null,
    height_cm: null,
    avatar_file_id: null,
    deleted_at: null,
    first_name: "Matt",
    last_name: "Kingston",
    avatar_url: null,
    ...overrides,
  }
}

describe("auth startup shell gate", () => {
  it("authenticated session + slow profile → shell renders without waiting for profile", () => {
    const phase = resolveAuthShellPhase({
      configured: true,
      sessionPending: false,
      user: fakeUser(),
    })
    assert.equal(phase, "authenticated")
    assert.equal(shouldRenderAppShell(phase), true)

    // Profile still null — display falls back to user metadata.
    assert.equal(resolveShellDisplayName(null, fakeUser()), "Matt")
    assert.equal(resolveShellEmail(null, fakeUser()), "coach@example.com")
  })

  it("authenticated session + profile failure → shell still renders safely", () => {
    const phase = resolveAuthShellPhase({
      configured: true,
      sessionPending: false,
      user: fakeUser({ user_metadata: {} }),
    })
    assert.equal(phase, "authenticated")
    assert.equal(shouldRenderAppShell(phase), true)
    assert.equal(
      resolveShellDisplayName(null, fakeUser({ user_metadata: {}, email: "xy@z.com" })),
      "xy"
    )
    assert.equal(resolveShellInitials("there", "xy@z.com"), "XY")
  })

  it("no authenticated session → unauthenticated (redirect), not shell content", () => {
    const pending = resolveAuthShellPhase({
      configured: true,
      sessionPending: true,
      user: null,
    })
    assert.equal(pending, "session_pending")
    assert.equal(shouldRenderAppShell(pending), true) // chrome skeleton only

    const none = resolveAuthShellPhase({
      configured: true,
      sessionPending: false,
      user: null,
    })
    assert.equal(none, "unauthenticated")
    // Full authenticated children must not render; layout returns null.
    assert.equal(shouldRenderAppShell(none), false)
  })

  it("profile arrival updates the shell display correctly", () => {
    const user = fakeUser({
      email: "coach@example.com",
      user_metadata: { first_name: "Temp" },
    })
    assert.equal(resolveShellDisplayName(null, user), "Temp")

    const profile = fakeProfile({
      first_name: "Matthew",
      display_name: "Matthew Kingston",
      email: "matt@clarenceparkhealthsuite.co.uk",
    })
    assert.equal(resolveShellDisplayName(profile, user), "Matthew")
    assert.equal(
      resolveShellEmail(profile, user),
      "matt@clarenceparkhealthsuite.co.uk"
    )
  })

  it("session_pending does not imply authenticated access", () => {
    assert.equal(
      resolveAuthShellPhase({
        configured: true,
        sessionPending: true,
        user: null,
      }),
      "session_pending"
    )
    assert.notEqual(
      resolveAuthShellPhase({
        configured: true,
        sessionPending: true,
        user: null,
      }),
      "authenticated"
    )
  })
})
