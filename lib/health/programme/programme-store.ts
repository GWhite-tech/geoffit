/**
 * ProgrammeStore — library + active programme persistence.
 * Source-agnostic: templates, imports, AI, coach, and shared all land here.
 */

import type { Programme } from "@/lib/domain/programme"

import { listProgrammeTemplates } from "./templates"

const STORAGE_KEY = "geoffit.programme-store.v1"

type Listener = () => void

type PersistPayload = {
  version: 1
  activeProgrammeId: string | null
  /** Cursor into the active programme timeline */
  currentWeekNumber: number
  /** Index of next session within the current week (0-based) */
  nextSessionOrder: number
  programmes: Programme[]
  updatedAt: string
}

export class ProgrammeStore {
  private programmes: Programme[] = []
  private activeProgrammeId: string | null = null
  private currentWeekNumber = 1
  private nextSessionOrder = 0
  private listeners = new Set<Listener>()
  private hydrated = false
  private version = 0

  hydrateFromStorage(): void {
    if (typeof window === "undefined") return
    if (this.hydrated) return
    this.hydrated = true
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        this.seedTemplates()
        return
      }
      const parsed = JSON.parse(raw) as Partial<PersistPayload>
      if (Array.isArray(parsed.programmes) && parsed.programmes.length > 0) {
        this.programmes = parsed.programmes
      } else {
        this.seedTemplates()
      }
      this.activeProgrammeId = parsed.activeProgrammeId ?? null
      this.currentWeekNumber = parsed.currentWeekNumber ?? 1
      this.nextSessionOrder = parsed.nextSessionOrder ?? 0
    } catch {
      this.seedTemplates()
    }
  }

  private seedTemplates(): void {
    this.programmes = listProgrammeTemplates()
    this.persist()
  }

  getVersion(): number {
    return this.version
  }

  list(): Programme[] {
    this.hydrateFromStorage()
    return this.programmes
  }

  getById(id: string): Programme | null {
    this.hydrateFromStorage()
    return this.programmes.find((programme) => programme.id === id) ?? null
  }

  getActive(): Programme | null {
    this.hydrateFromStorage()
    if (!this.activeProgrammeId) return null
    return this.getById(this.activeProgrammeId)
  }

  getCursor(): { weekNumber: number; sessionOrder: number } {
    this.hydrateFromStorage()
    return {
      weekNumber: this.currentWeekNumber,
      sessionOrder: this.nextSessionOrder,
    }
  }

  /**
   * Activate a programme (clones to active status if still a template draft).
   */
  activate(programmeId: string, startDate?: string): void {
    this.hydrateFromStorage()
    const programme = this.getById(programmeId)
    if (!programme) return

    const now = new Date().toISOString()
    const activated: Programme = {
      ...programme,
      status: "active",
      startDate: startDate ?? now.slice(0, 10),
      updatedAt: now,
      version: {
        ...programme.version,
        version: programme.version.version + 1,
        createdAt: now,
        changeNote: "Activated",
      },
    }

    this.programmes = this.programmes.map((item) =>
      item.id === programmeId
        ? activated
        : item.status === "active"
          ? { ...item, status: "archived", updatedAt: now }
          : item
    )
    this.activeProgrammeId = programmeId
    this.currentWeekNumber = 1
    this.nextSessionOrder = 0
    this.persist()
    this.emit()
  }

  deactivate(): void {
    this.hydrateFromStorage()
    const now = new Date().toISOString()
    this.programmes = this.programmes.map((item) =>
      item.status === "active"
        ? { ...item, status: "archived", updatedAt: now }
        : item
    )
    this.activeProgrammeId = null
    this.currentWeekNumber = 1
    this.nextSessionOrder = 0
    this.persist()
    this.emit()
  }

  setCursor(weekNumber: number, sessionOrder: number): void {
    this.hydrateFromStorage()
    this.currentWeekNumber = Math.max(1, weekNumber)
    this.nextSessionOrder = Math.max(0, sessionOrder)
    this.persist()
    this.emit()
  }

  advanceAfterSession(): void {
    this.hydrateFromStorage()
    const active = this.getActive()
    if (!active) return
    const week =
      active.weeks.find((item) => item.weekNumber === this.currentWeekNumber) ??
      active.weeks[0]
    if (!week) return
    const nextOrder = this.nextSessionOrder + 1
    if (nextOrder >= week.sessions.length) {
      const nextWeek = this.currentWeekNumber + 1
      const hasNext = active.weeks.some((item) => item.weekNumber === nextWeek)
      this.currentWeekNumber = hasNext ? nextWeek : this.currentWeekNumber
      this.nextSessionOrder = 0
    } else {
      this.nextSessionOrder = nextOrder
    }
    this.persist()
    this.emit()
  }

  upsert(programme: Programme): void {
    this.hydrateFromStorage()
    const exists = this.programmes.some((item) => item.id === programme.id)
    this.programmes = exists
      ? this.programmes.map((item) =>
          item.id === programme.id ? programme : item
        )
      : [...this.programmes, programme]
    this.persist()
    this.emit()
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
        activeProgrammeId: this.activeProgrammeId,
        currentWeekNumber: this.currentWeekNumber,
        nextSessionOrder: this.nextSessionOrder,
        programmes: this.programmes,
        updatedAt: new Date().toISOString(),
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

let singleton: ProgrammeStore | null = null

export function getProgrammeStore(): ProgrammeStore {
  if (!singleton) singleton = new ProgrammeStore()
  return singleton
}

export function resetProgrammeStore(): void {
  singleton = null
}
