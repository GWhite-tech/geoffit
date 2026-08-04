import type { ProgressRange } from "./types"

const STORAGE_KEY = "geoffit.progress-store.v1"

type Listener = () => void

type PersistedShape = {
  range: ProgressRange
}

/**
 * ProgressStore — UI preferences for the Progress page.
 * Metric data always comes from Health / Blood / Nutrition / Treatment stores.
 */
export class ProgressStore {
  private range: ProgressRange = "90d"
  private listeners = new Set<Listener>()
  private hydrated = false

  getRange(): ProgressRange {
    return this.range
  }

  setRange(range: ProgressRange): void {
    if (this.range === range) return
    this.range = range
    this.persist()
    this.emit()
  }

  getVersion(): number {
    return this.range.length
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  hydrateFromStorage(): void {
    if (typeof window === "undefined" || this.hydrated) return
    this.hydrated = true
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as PersistedShape
      if (
        parsed.range === "30d" ||
        parsed.range === "90d" ||
        parsed.range === "6m" ||
        parsed.range === "1y" ||
        parsed.range === "all"
      ) {
        this.range = parsed.range
      }
    } catch {
      // ignore
    }
    this.emit()
  }

  private persist(): void {
    if (typeof window === "undefined") return
    try {
      const payload: PersistedShape = { range: this.range }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // ignore
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

let singleton: ProgressStore | null = null

export function getProgressStore(): ProgressStore {
  if (!singleton) singleton = new ProgressStore()
  return singleton
}

export function resetProgressStore(): void {
  singleton = null
}
