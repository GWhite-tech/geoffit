import { createHash, randomBytes } from "node:crypto"

/** Opaque invitation token (URL/request only). Never persist plaintext. */
export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url")
}

/** SHA-256 hex digest stored in coach_invitations.token_hash. */
export function hashInvitationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex")
}
