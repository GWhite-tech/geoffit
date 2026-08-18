/**
 * Safe post-auth return paths (`?next=`).
 * Relative same-origin paths only — never open redirects.
 */

import { DEFAULT_AUTH_REDIRECT } from "./constants"

const SAFE_ORIGIN = "https://geoffit.invalid"

/**
 * Parse a caller-supplied `next` value.
 * Returns null when missing or unsafe (open redirect / malformed).
 */
export function parseSafeAuthNext(
  raw: string | null | undefined
): string | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Relative path only — reject protocol-relative and absolute URLs.
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null
  if (trimmed.includes("\\") || /[\u0000-\u001f\u007f]/.test(trimmed)) {
    return null
  }
  // Block userinfo / authority confusion in the path string.
  if (trimmed.includes("@")) return null

  let url: URL
  try {
    url = new URL(trimmed, SAFE_ORIGIN)
  } catch {
    return null
  }

  if (url.origin !== SAFE_ORIGIN) return null
  if (url.username || url.password) return null
  if (url.pathname.includes("://")) return null

  // Keep pathname + search; drop hash (not used for invite tokens).
  const result = `${url.pathname}${url.search}`
  if (!result.startsWith("/") || result.startsWith("//")) return null
  return result
}

/** Resolve `next` or fall back to the default post-auth destination. */
export function resolveSafeAuthNext(
  raw: string | null | undefined,
  fallback: string = DEFAULT_AUTH_REDIRECT
): string {
  return parseSafeAuthNext(raw) ?? fallback
}

/**
 * Build `/login` or `/register` href, preserving a safe `next` when present.
 */
export function authHrefWithNext(
  pathname: "/login" | "/register",
  rawNext: string | null | undefined
): string {
  const safe = parseSafeAuthNext(rawNext)
  if (!safe) return pathname
  return `${pathname}?next=${encodeURIComponent(safe)}`
}

/** Build `/auth/callback?next=…` for email confirmation / recovery links. */
export function authCallbackUrlWithNext(
  origin: string,
  rawNext: string | null | undefined
): string {
  const next = resolveSafeAuthNext(rawNext)
  const url = new URL("/auth/callback", origin)
  url.searchParams.set("next", next)
  return url.toString()
}
