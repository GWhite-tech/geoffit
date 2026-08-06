/**
 * Lightweight local state for the temporary cloud→store bootstrap bridge.
 * Removable once cloud-first hydration (PR4) ships.
 */

export const BOOTSTRAP_VERSION = 1

const STATE_KEY_PREFIX = "geoffit.bootstrap.v1"
const DISABLED_KEY = "geoffit.bootstrap.disabled"

export type BootstrapDomainResult =
  | "restored"
  | "skipped_local_data"
  | "skipped_no_ingest"
  | "skipped_incomplete"
  | "error"

export type BootstrapState = {
  version: number
  lastRunAt: string | null
  results: Partial<
    Record<"apple_health" | "blood" | "hevy", BootstrapDomainResult>
  >
}

function stateKey(userId: string): string {
  return `${STATE_KEY_PREFIX}:${userId}`
}

export function isBootstrapDisabled(): boolean {
  if (typeof window === "undefined") return true
  try {
    return window.localStorage.getItem(DISABLED_KEY) === "1"
  } catch {
    return false
  }
}

/** Set localStorage geoffit.bootstrap.disabled=1 to turn the bridge off. */
export function setBootstrapDisabled(disabled: boolean): void {
  if (typeof window === "undefined") return
  try {
    if (disabled) window.localStorage.setItem(DISABLED_KEY, "1")
    else window.localStorage.removeItem(DISABLED_KEY)
  } catch {
    // ignore
  }
}

export function readBootstrapState(userId: string): BootstrapState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(stateKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as BootstrapState
    if (!parsed || typeof parsed.version !== "number") return null
    return parsed
  } catch {
    return null
  }
}

export function writeBootstrapState(
  userId: string,
  state: BootstrapState
): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(stateKey(userId), JSON.stringify(state))
  } catch {
    // ignore quota
  }
}

export function clearBootstrapState(userId: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(stateKey(userId))
  } catch {
    // ignore
  }
}
