/**
 * Typed errors for cloud fact repositories (PR2).
 */

export type CloudRepositoryErrorCode =
  | "rls"
  | "unique_violation"
  | "foreign_key"
  | "not_found"
  | "invalid_input"
  | "network"
  | "unknown"

export class CloudRepositoryError extends Error {
  readonly code: CloudRepositoryErrorCode
  readonly cause?: unknown

  constructor(
    code: CloudRepositoryErrorCode,
    message: string,
    cause?: unknown
  ) {
    super(message)
    this.name = "CloudRepositoryError"
    this.code = code
    this.cause = cause
  }
}

export function mapSupabaseError(error: {
  message?: string
  code?: string
  details?: string
}): CloudRepositoryError {
  const message = error.message ?? "Supabase request failed"
  const code = (error.code ?? "").toUpperCase()
  const lower = message.toLowerCase()

  if (
    code === "42501" ||
    lower.includes("row-level security") ||
    lower.includes("permission denied")
  ) {
    return new CloudRepositoryError("rls", message, error)
  }
  if (code === "23505" || lower.includes("duplicate key")) {
    return new CloudRepositoryError("unique_violation", message, error)
  }
  if (code === "23503" || lower.includes("foreign key")) {
    return new CloudRepositoryError("foreign_key", message, error)
  }
  if (lower.includes("fetch") || lower.includes("network")) {
    return new CloudRepositoryError("network", message, error)
  }
  return new CloudRepositoryError("unknown", message, error)
}
