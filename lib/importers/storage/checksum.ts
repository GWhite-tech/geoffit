/** SHA-256 hex digest of a File / Blob (SubtleCrypto). */

export async function sha256Hex(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest("SHA-256", buffer)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export function buildStorageObjectPath(
  userId: string,
  fileName: string,
  objectId: string = crypto.randomUUID()
): string {
  const now = new Date()
  const yyyy = String(now.getUTCFullYear())
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0")
  const ext = fileName.includes(".")
    ? `.${fileName.split(".").pop()!.toLowerCase()}`
    : ""
  return `${userId}/${yyyy}/${mm}/${objectId}${ext}`
}
