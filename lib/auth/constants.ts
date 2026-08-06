/** Routes that never require a session. */
export const AUTH_PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
] as const

export const DEFAULT_AUTH_REDIRECT = "/mission-control"
/** App home is Mission Control (`/` and `/mission-control`). */
export const MISSION_CONTROL_PATHS = ["/", "/mission-control"] as const

export const REMEMBER_ME_COOKIE = "geoffit-remember-me"
export const REMEMBER_ME_MAX_AGE_SECONDS = 60 * 60 * 24 * 400 // ~13 months
export const SESSION_ONLY_MAX_AGE_SECONDS = 60 * 60 * 12 // 12 hours

export const MIN_PASSWORD_LENGTH = 8

export function isAuthPublicPath(pathname: string): boolean {
  return AUTH_PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}
