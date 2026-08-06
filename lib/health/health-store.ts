import type { HealthRecord } from "@/lib/domain/health"

import { generateHealthSummary, type HealthSummary } from "./health-summary"
import { idbLoadRecords, idbSaveRecords } from "./health-persistence"
import { extractDomainRecordsFromPayload } from "./types"

const LEGACY_STORAGE_KEY = "geoffit.health-store.v1"

type Listener = () => void

/** Stable empty snapshot for SSR / pre-hydration — never regenerated. */
const EMPTY_SUMMARY: HealthSummary = generateHealthSummary([])

function countByType(records: HealthRecord[]) {
  const counts = {
    total: records.length,
    body_mass: 0,
    sleep_analysis: 0,
    heart_rate_variability: 0,
    resting_heart_rate: 0,
    workout: 0,
    other: 0,
  }
  for (const record of records) {
    if (record.type in counts) {
      counts[record.type as keyof typeof counts]++
    } else {
      counts.other++
    }
  }
  return counts
}

/**
 * Geoffit's central health read model.
 * Pure TypeScript — no React, no UI, no Supabase.
 */
export class HealthStore {
  private records: HealthRecord[] = []
  private currentSummary: HealthSummary = EMPTY_SUMMARY
  private listeners = new Set<Listener>()
  private summaryOptions: { name?: string; weightGoalLb?: number } = {
    name: "Geoff",
  }
  private hydrated = false
  private hydratePromise: Promise<void> | null = null

  constructor(initial: HealthRecord[] = []) {
    if (initial.length > 0) {
      this.records = this.dedupe(initial)
      this.currentSummary = generateHealthSummary(
        this.records,
        this.summaryOptions
      )
    }
  }

  setRecords(records: HealthRecord[]): void {
    this.records = this.dedupe(records)
    this.recomputeSummary()
    void this.persist()
    this.emit()
  }

  async ingest(records: HealthRecord[]): Promise<void> {
    console.info("[HealthStore] ingest() called", countByType(records))
    if (records.length === 0) {
      console.warn("[HealthStore] ingest() received 0 records — store unchanged")
      return
    }
    const next = this.dedupe([...this.records, ...records])
    if (next.length === this.records.length) {
      const before = new Set(this.records.map((r) => r.fingerprint || r.id))
      const changed = next.some((r) => !before.has(r.fingerprint || r.id))
      if (!changed) {
        console.warn(
          "[HealthStore] ingest() produced no new fingerprints — store unchanged",
          { existing: this.records.length }
        )
        return
      }
    }
    this.records = next
    this.hydrated = true
    this.recomputeSummary()
    console.info(
      "[HealthStore] after ingest",
      countByType(this.records),
      "hasData=",
      this.currentSummary.hasData,
      "summary.recordCount=",
      this.currentSummary.recordCount
    )
    await this.persist()
    this.emit()
  }

  /**
   * Bulk ingest for streamed Apple Health batches: merge in memory,
   * persist + summary once at commit (avoids O(n) sort/IDB write per batch).
   */
  private bulkMap: Map<string, HealthRecord> | null = null

  beginBulkIngest(): void {
    this.bulkMap = new Map(
      this.records.map((record) => [record.fingerprint || record.id, record])
    )
  }

  addBulkIngest(records: HealthRecord[]): void {
    if (!this.bulkMap) {
      this.beginBulkIngest()
    }
    const map = this.bulkMap!
    for (const record of records) {
      map.set(record.fingerprint || record.id, record)
    }
  }

  async commitBulkIngest(): Promise<void> {
    if (!this.bulkMap) return
    this.records = [...this.bulkMap.values()].sort((a, b) =>
      a.startDate.localeCompare(b.startDate)
    )
    this.bulkMap = null
    this.hydrated = true
    this.recomputeSummary()
    console.info(
      "[HealthStore] after bulk ingest",
      countByType(this.records),
      "hasData=",
      this.currentSummary.hasData
    )
    await this.persist()
    this.emit()
  }

  clear(): void {
    if (this.records.length === 0 && this.currentSummary === EMPTY_SUMMARY) {
      return
    }
    this.records = []
    this.currentSummary = EMPTY_SUMMARY
    void this.persist()
    this.emit()
  }

  getAll(): HealthRecord[] {
    return this.records
  }

  getRecordCount(): number {
    return this.records.length
  }

  /** True after IndexedDB hydrate finished (even when zero records). */
  isHydrated(): boolean {
    return this.hydrated
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot(): HealthSummary {
    return this.currentSummary
  }

  getSummary(options?: { name?: string; weightGoalLb?: number }): HealthSummary {
    if (options) {
      const nameChanged =
        options.name !== undefined && options.name !== this.summaryOptions.name
      const goalChanged =
        options.weightGoalLb !== undefined &&
        options.weightGoalLb !== this.summaryOptions.weightGoalLb
      if (nameChanged || goalChanged) {
        this.summaryOptions = { ...this.summaryOptions, ...options }
        this.recomputeSummary()
        this.emit()
      }
    }
    return this.currentSummary
  }

  getCurrentWeight() {
    return this.currentSummary.currentWeight
  }

  getLatestSleep() {
    return this.currentSummary.latestSleep
  }

  getLatestRecovery() {
    return this.currentSummary.recovery
  }

  getLatestWorkout() {
    return this.currentSummary.lastWorkout
  }

  getTimeline() {
    return this.currentSummary.timeline
  }

  /** Sync legacy helper — prefer hydrateFromStorageAsync. */
  hydrateFromStorage(): void {
    void this.hydrateFromStorageAsync()
  }

  hydrateFromStorageAsync(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve()
    // In-memory already authoritative (e.g. just confirmed import).
    if (this.hydrated && this.records.length > 0) {
      return Promise.resolve()
    }
    if (this.hydratePromise) return this.hydratePromise

    this.hydratePromise = (async () => {
      try {
        let loaded = await idbLoadRecords<HealthRecord>()

        if (!loaded || loaded.length === 0) {
          // Migrate legacy localStorage if present (small datasets only).
          try {
            const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
            if (raw) {
              const parsed = JSON.parse(raw) as { records?: HealthRecord[] }
              if (Array.isArray(parsed.records) && parsed.records.length > 0) {
                loaded = parsed.records
                await idbSaveRecords(loaded)
                window.localStorage.removeItem(LEGACY_STORAGE_KEY)
              }
            }
          } catch {
            // ignore legacy migration errors
          }
        }

        if (!loaded || loaded.length === 0) {
          this.hydrated = true
          console.info("[HealthStore] hydrate: no persisted records")
          this.emit()
          return
        }

        // Merge so a mid-flight confirm cannot be clobbered by a slower IDB read.
        const next = this.dedupe([...loaded, ...this.records])
        this.records = next
        this.hydrated = true
        // Emit records immediately so Mission Control / hooks can paint.
        // Full summary recompute is deferred — it walks every selector and
        // was blocking first meaningful paint after the ready-gate fix.
        this.emit()
        console.info(
          "[HealthStore] hydrate restored",
          countByType(this.records),
          "hasData=",
          this.records.length > 0
        )
        queueMicrotask(() => {
          if (this.records !== next) return
          try {
            this.recomputeSummary()
            this.emit()
          } catch (summaryError) {
            console.error(
              "[HealthStore] summary recompute failed after hydrate",
              summaryError
            )
          }
        })
      } catch (error) {
        this.hydrated = true
        console.error("[HealthStore] hydrate failed", error)
        this.emit()
      } finally {
        // Allow a later retry if this attempt left the store empty (e.g. IDB
        // was not ready on the first read during boot).
        if (this.records.length === 0) {
          this.hydratePromise = null
          this.hydrated = false
        }
      }
    })()

    return this.hydratePromise
  }

  async ingestFromImportRecords(
    importRecords: Array<{ payload?: Record<string, unknown> }>
  ): Promise<void> {
    const domain = extractDomainRecordsFromPayload(importRecords)
    console.info(
      "[HealthStore] ingestFromImportRecords extracted",
      domain.length,
      "from",
      importRecords.length,
      "import rows"
    )
    await this.ingest(domain)
  }

  private recomputeSummary(): void {
    this.currentSummary =
      this.records.length === 0
        ? EMPTY_SUMMARY
        : generateHealthSummary(this.records, this.summaryOptions)
    console.info("[HealthStore] generateHealthSummary()", {
      inputRecords: this.records.length,
      hasData: this.currentSummary.hasData,
      recordCount: this.currentSummary.recordCount,
      weight: this.currentSummary.snapshot.weight.value,
      sleep: this.currentSummary.snapshot.sleep.value,
      hrv: this.currentSummary.snapshot.hrv.value,
    })
  }

  private async persist(): Promise<void> {
    if (typeof window === "undefined") return
    try {
      await idbSaveRecords(this.records)
      console.info(
        "[HealthStore] persisted to IndexedDB",
        this.records.length,
        "records"
      )
    } catch (error) {
      console.error(
        "[HealthStore] IndexedDB persist failed — in-memory data still available",
        error
      )
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }

  private dedupe(records: HealthRecord[]): HealthRecord[] {
    const byFingerprint = new Map<string, HealthRecord>()
    for (const record of records) {
      const key = record.fingerprint || record.id
      byFingerprint.set(key, record)
    }
    return [...byFingerprint.values()].sort((a, b) =>
      a.startDate.localeCompare(b.startDate)
    )
  }
}

let sharedStore: HealthStore | null = null

export function getHealthStore(): HealthStore {
  if (!sharedStore) {
    sharedStore = new HealthStore()
  }
  return sharedStore
}

export function resetHealthStore(): void {
  sharedStore = null
}

export { EMPTY_SUMMARY }
