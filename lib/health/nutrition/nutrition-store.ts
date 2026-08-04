import type {
  NutritionDay,
  NutritionTargets,
} from "@/lib/domain/nutrition"
import { DEFAULT_NUTRITION_TARGETS } from "@/lib/domain/nutrition"
import type { HealthRecord } from "@/lib/domain/health"
import { buildNutritionDaysFromHealthRecords } from "@/lib/health/nutrition/from-health-store"

const STORAGE_KEY = "geoffit.nutrition-store.v1"

type Listener = () => void

type PersistedShape = {
  version: number
  updatedAt: string
  days: NutritionDay[]
  targets: NutritionTargets
  /** @deprecated Seeded demo data is no longer used. */
  seeded?: boolean
}

/**
 * Daily nutrition totals derived from HealthStore dietary samples.
 * Pure TypeScript — no React. No demo/seed data.
 */
export class NutritionStore {
  private days: NutritionDay[] = []
  private targets: NutritionTargets = { ...DEFAULT_NUTRITION_TARGETS }
  private listeners = new Set<Listener>()
  private hydrated = false
  private lastHealthFingerprint = ""

  getDays(): NutritionDay[] {
    return this.days
  }

  getTargets(): NutritionTargets {
    return this.targets
  }

  getDay(date: string): NutritionDay | null {
    return this.days.find((day) => day.date === date) ?? null
  }

  getLatestDay(): NutritionDay | null {
    if (this.days.length === 0) return null
    return [...this.days].sort((a, b) => b.date.localeCompare(a.date))[0]!
  }

  getVersion(): number {
    return (
      this.days.length * 100 +
      Object.values(this.targets).reduce((a, b) => a + b, 0) +
      this.lastHealthFingerprint.length
    )
  }

  setTargets(targets: NutritionTargets): void {
    this.targets = { ...targets }
    this.persist()
    this.emit()
  }

  /**
   * Rebuild daily totals exclusively from HealthStore dietary records.
   * Clears any previously seeded / mock nutrition days.
   */
  syncFromHealthRecords(records: HealthRecord[]): void {
    const fingerprint = healthFingerprint(records)
    if (fingerprint === this.lastHealthFingerprint) return
    this.applyHealthRecords(records, fingerprint)
  }

  /** Rebuild days even when the HealthStore fingerprint is unchanged. */
  forceSyncFromHealthRecords(records: HealthRecord[]): void {
    this.applyHealthRecords(records, healthFingerprint(records))
  }

  private applyHealthRecords(
    records: HealthRecord[],
    fingerprint: string
  ): void {
    const days = buildNutritionDaysFromHealthRecords(records).filter(
      (day) => day.source !== "seed"
    )

    this.days = days
    this.lastHealthFingerprint = fingerprint
    this.persist()
    this.emit()
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
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedShape
        if (parsed.targets) {
          this.targets = { ...DEFAULT_NUTRITION_TARGETS, ...parsed.targets }
        }
        // Never restore seeded demo days — only real (non-seed) aggregates.
        const restored = Array.isArray(parsed.days) ? parsed.days : []
        this.days = restored.filter((day) => day.source !== "seed")
      }
    } catch {
      // ignore corrupt storage
    }
    this.emit()
  }

  private persist(): void {
    if (typeof window === "undefined") return
    try {
      const payload: PersistedShape = {
        version: 2,
        updatedAt: new Date().toISOString(),
        days: this.days.filter((day) => day.source !== "seed"),
        targets: this.targets,
        seeded: false,
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // quota / private mode
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

function healthFingerprint(records: HealthRecord[]): string {
  const dietary = records.filter((record) =>
    String(record.type).startsWith("dietary_")
  )
  return `${records.length}:${dietary.length}:${dietary[0]?.id ?? ""}:${dietary[dietary.length - 1]?.id ?? ""}`
}

let singleton: NutritionStore | null = null

export function getNutritionStore(): NutritionStore {
  if (!singleton) singleton = new NutritionStore()
  return singleton
}

export function resetNutritionStore(): void {
  singleton = null
}
