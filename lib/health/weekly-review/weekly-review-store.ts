/**
 * WeeklyReviewStore — persisted generated reviews + selected week.
 */

import type { WeeklyReviewRecord, WeeklyReviewView } from "./types"
import { defaultWeeklyReviewWeekId } from "./week"

const STORAGE_KEY = "geoffit.weekly-review-store.v1"

type Listener = () => void

type PersistPayload = {
  version: 1
  selectedWeekId: string | null
  reviews: WeeklyReviewRecord[]
  /** Preferred local generation day/time — Sunday 23:59 default */
  schedule: { weekday: number; hour: number; minute: number }
}

export class WeeklyReviewStore {
  private reviews: WeeklyReviewRecord[] = []
  private selectedWeekId: string | null = null
  private schedule = { weekday: 0, hour: 23, minute: 59 }
  private listeners = new Set<Listener>()
  private hydrated = false
  private version = 0

  hydrateFromStorage(): void {
    if (typeof window === "undefined") return
    if (this.hydrated) return
    this.hydrated = true
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<PersistPayload>
      if (Array.isArray(parsed.reviews)) this.reviews = parsed.reviews
      this.selectedWeekId = parsed.selectedWeekId ?? null
      if (parsed.schedule) this.schedule = parsed.schedule
    } catch {
      // ignore
    }
  }

  getVersion(): number {
    return this.version
  }

  getSchedule() {
    this.hydrateFromStorage()
    return this.schedule
  }

  setSchedule(schedule: PersistPayload["schedule"]): void {
    this.schedule = schedule
    this.persist()
    this.emit()
  }

  list(): WeeklyReviewRecord[] {
    this.hydrateFromStorage()
    return [...this.reviews].sort((a, b) =>
      b.view.bounds.start.localeCompare(a.view.bounds.start)
    )
  }

  getSelectedWeekId(): string | null {
    this.hydrateFromStorage()
    return this.selectedWeekId ?? defaultWeeklyReviewWeekId()
  }

  setSelectedWeekId(weekId: string): void {
    this.selectedWeekId = weekId
    this.persist()
    this.emit()
  }

  getByWeekId(weekId: string): WeeklyReviewRecord | null {
    this.hydrateFromStorage()
    return this.reviews.find((item) => item.weekId === weekId) ?? null
  }

  save(
    view: WeeklyReviewView,
    options?: { select?: boolean }
  ): WeeklyReviewRecord {
    this.hydrateFromStorage()
    const record: WeeklyReviewRecord = {
      id: `${view.id}:${view.generatedAt}`,
      weekId: view.id,
      generatedAt: view.generatedAt,
      view,
    }
    this.reviews = [
      record,
      ...this.reviews.filter((item) => item.weekId !== view.id),
    ].slice(0, 52)
    if (options?.select || this.selectedWeekId == null) {
      this.selectedWeekId = view.id
    }
    this.persist()
    this.emit()
    return record
  }

  /**
   * Generate-on-open helper: if current/previous week missing, caller builds + save.
   */
  needsGeneration(weekId: string): boolean {
    this.hydrateFromStorage()
    return !this.reviews.some((item) => item.weekId === weekId)
  }

  /**
   * True when local time matches configured Sunday 23:59 window (±1 minute).
   */
  shouldAutoGenerate(now = new Date()): boolean {
    this.hydrateFromStorage()
    return (
      now.getDay() === this.schedule.weekday &&
      now.getHours() === this.schedule.hour &&
      now.getMinutes() === this.schedule.minute
    )
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private persist(): void {
    if (typeof window === "undefined") return
    try {
      const payload: PersistPayload = {
        version: 1,
        selectedWeekId: this.selectedWeekId,
        reviews: this.reviews,
        schedule: this.schedule,
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // ignore
    }
  }

  private emit(): void {
    this.version += 1
    for (const listener of this.listeners) listener()
  }
}

let singleton: WeeklyReviewStore | null = null

export function getWeeklyReviewStore(): WeeklyReviewStore {
  if (!singleton) singleton = new WeeklyReviewStore()
  return singleton
}

export function resetWeeklyReviewStore(): void {
  singleton = null
}
