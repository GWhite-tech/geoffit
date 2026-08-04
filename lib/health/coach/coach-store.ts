import type { CoachHealthContext, CoachMemorySnapshot } from "./types"

type Listener = () => void

/**
 * CoachStore — active coaching session state + cached context.
 * Conversations live in ConversationStore. Metric data stays in domain stores.
 */
export class CoachStore {
  private context: CoachHealthContext | null = null
  private memory: CoachMemorySnapshot | null = null
  private composing = false
  private listeners = new Set<Listener>()

  getContext(): CoachHealthContext | null {
    return this.context
  }

  getMemory(): CoachMemorySnapshot | null {
    return this.memory
  }

  isComposing(): boolean {
    return this.composing
  }

  setContext(context: CoachHealthContext, memory: CoachMemorySnapshot): void {
    this.context = context
    this.memory = memory
    this.emit()
  }

  setComposing(value: boolean): void {
    if (this.composing === value) return
    this.composing = value
    this.emit()
  }

  getVersion(): number {
    return (
      (this.context?.generatedAt.length ?? 0) +
      (this.memory?.facts.length ?? 0) * 10 +
      (this.composing ? 1 : 0)
    )
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

let singleton: CoachStore | null = null

export function getCoachStore(): CoachStore {
  if (!singleton) singleton = new CoachStore()
  return singleton
}

export function resetCoachStore(): void {
  singleton = null
}
