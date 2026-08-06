/**
 * Map Supabase / network errors to friendly, non-leaky copy.
 */
export function toFriendlyAuthError(error: unknown): string {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "You appear to be offline. Check your connection and try again."
  }

  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : typeof error === "string"
        ? error
        : ""

  const status =
    error && typeof error === "object" && "status" in error
      ? Number((error as { status: unknown }).status)
      : undefined

  const normalized = message.toLowerCase()

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("fetch")
  ) {
    return "Geoffit Cloud is temporarily unavailable. Please try again shortly."
  }

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid credentials") ||
    status === 400 && normalized.includes("invalid")
  ) {
    return "Incorrect email or password."
  }

  if (
    normalized.includes("user already registered") ||
    normalized.includes("already been registered") ||
    normalized.includes("email address is already")
  ) {
    return "An account with this email already exists. Try signing in instead."
  }

  if (
    normalized.includes("password") &&
    (normalized.includes("weak") ||
      normalized.includes("least") ||
      normalized.includes("short") ||
      normalized.includes("characters"))
  ) {
    return "Password is too weak. Use at least 8 characters with a mix of letters and numbers."
  }

  if (
    normalized.includes("email not confirmed") ||
    normalized.includes("email_not_confirmed")
  ) {
    return "Please confirm your email before signing in. Check your inbox for a verification link."
  }

  if (
    normalized.includes("otp_expired") ||
    normalized.includes("expired") ||
    normalized.includes("flow_state") ||
    normalized.includes("same site")
  ) {
    return "This password reset link has expired. Request a new one."
  }

  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again."
  }

  if (normalized.includes("signup is disabled")) {
    return "Registration is currently disabled. Please contact support."
  }

  if (!message) {
    return "Something went wrong. Please try again."
  }

  // Never surface raw provider internals to the UI.
  return "Something went wrong. Please try again."
}
