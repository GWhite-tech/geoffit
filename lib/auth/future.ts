/**
 * Future auth providers — keep UI/actions ready to extend without redesign.
 *
 * Planned:
 * - Sign in with Apple
 * - Google
 * - Microsoft
 * - Passkeys (WebAuthn)
 * - MFA (TOTP / SMS)
 * - Family accounts (workspaces)
 * - Coach accounts (grants)
 *
 * Implementation sketch (not active):
 *   supabase.auth.signInWithOAuth({ provider: "apple" | "google" | "azure" })
 *   supabase.auth.signInWithPasskey(...)
 *   supabase.auth.mfa.*
 */

export const FUTURE_OAUTH_PROVIDERS = [
  "apple",
  "google",
  "azure",
] as const

export type FutureOAuthProvider = (typeof FUTURE_OAUTH_PROVIDERS)[number]
