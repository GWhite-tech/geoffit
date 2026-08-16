/**
 * Parse invitation accept token from a URL / search params.
 * Never accepts token_hash / tokenHash.
 */

export type AcceptTokenParseResult =
  | { ok: true; token: string }
  | { ok: false; reason: "missing" | "invalid" | "hash_field" }

export function parseAcceptTokenFromSearchParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>
): AcceptTokenParseResult {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) {
      return params.get(key)
    }
    const v = params[key]
    if (Array.isArray(v)) return v[0] ?? null
    return typeof v === "string" ? v : null
  }

  if (get("token_hash") != null || get("tokenHash") != null) {
    return { ok: false, reason: "hash_field" }
  }

  const token = (get("token") ?? "").trim()
  if (!token) return { ok: false, reason: "missing" }
  if (token.length < 16) return { ok: false, reason: "invalid" }
  return { ok: true, token }
}

/** Body builder for accept API — only `{ token }`. */
export function buildAcceptInvitationBody(token: string): { token: string } {
  return { token: token.trim() }
}

export function acceptBodyContainsHashFields(
  body: Record<string, unknown>
): boolean {
  return "token_hash" in body || "tokenHash" in body
}
