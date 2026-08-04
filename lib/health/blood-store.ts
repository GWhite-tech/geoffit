import type { BloodTest } from "@/lib/domain/blood"

const STORAGE_KEY = "geoffit.blood-store.v1"

type Listener = () => void

/**
 * Central blood-test read model.
 * Pure TypeScript — no React, no UI.
 */
export class BloodStore {
  private tests: BloodTest[] = []
  private listeners = new Set<Listener>()
  private hydrated = false

  constructor(initial: BloodTest[] = []) {
    if (initial.length > 0) {
      this.tests = this.dedupe(initial)
    }
  }

  setTests(tests: BloodTest[]): void {
    this.tests = this.dedupe(tests)
    this.persist()
    this.emit()
  }

  ingest(tests: BloodTest[]): void {
    if (tests.length === 0) return
    const next = this.dedupe([...this.tests, ...tests])
    if (
      next.length === this.tests.length &&
      next.every(
        (test, i) =>
          (test.fingerprint || test.id) ===
          (this.tests[i]?.fingerprint || this.tests[i]?.id)
      )
    ) {
      return
    }
    this.tests = next
    this.persist()
    this.emit()
  }

  clear(): void {
    if (this.tests.length === 0) return
    this.tests = []
    this.persist()
    this.emit()
  }

  getAll(): BloodTest[] {
    return this.tests
  }

  getLatest(): BloodTest | null {
    if (this.tests.length === 0) return null
    return [...this.tests].sort((a, b) =>
      b.testDate.localeCompare(a.testDate)
    )[0]
  }

  getTestCount(): number {
    return this.tests.length
  }

  getMarkerCount(): number {
    return this.tests.reduce((sum, test) => sum + test.markers.length, 0)
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot(): BloodTest[] {
    return this.tests
  }

  hydrateFromStorage(): void {
    if (typeof window === "undefined" || this.hydrated) return
    this.hydrated = true
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { tests?: BloodTest[] }
      if (!Array.isArray(parsed.tests) || parsed.tests.length === 0) return
      this.tests = this.dedupe(parsed.tests)
      this.emit()
    } catch {
      // ignore corrupt storage
    }
  }

  private persist(): void {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          updatedAt: new Date().toISOString(),
          tests: this.tests,
        })
      )
    } catch {
      // quota / private mode
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }

  private dedupe(tests: BloodTest[]): BloodTest[] {
    const byFingerprint = new Map<string, BloodTest>()
    for (const test of tests) {
      byFingerprint.set(test.fingerprint || test.id, test)
    }
    return [...byFingerprint.values()].sort((a, b) =>
      a.testDate.localeCompare(b.testDate)
    )
  }
}

let sharedBloodStore: BloodStore | null = null

export function getBloodStore(): BloodStore {
  if (!sharedBloodStore) {
    sharedBloodStore = new BloodStore()
  }
  return sharedBloodStore
}

export function resetBloodStore(): void {
  sharedBloodStore = null
}
