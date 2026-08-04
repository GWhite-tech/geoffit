import type { CoachConversation, CoachMessage, CoachTopic } from "./types"

const STORAGE_KEY = "geoffit.conversation-store.v1"

type Listener = () => void

type PersistedShape = {
  conversations: CoachConversation[]
  activeId: string | null
}

/**
 * ConversationStore — history, pin, rename, search.
 */
export class ConversationStore {
  private conversations: CoachConversation[] = []
  private activeId: string | null = null
  private listeners = new Set<Listener>()
  private hydrated = false

  getConversations(): CoachConversation[] {
    return [...this.conversations].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }

  getActiveId(): string | null {
    return this.activeId
  }

  getActive(): CoachConversation | null {
    if (!this.activeId) return null
    return this.conversations.find((c) => c.id === this.activeId) ?? null
  }

  getVersion(): number {
    return (
      this.conversations.length * 100 +
      this.conversations.reduce((sum, c) => sum + c.messages.length, 0) +
      (this.activeId?.length ?? 0)
    )
  }

  search(query: string): CoachConversation[] {
    const q = query.trim().toLowerCase()
    if (!q) return this.getConversations()
    return this.getConversations().filter(
      (conversation) =>
        conversation.title.toLowerCase().includes(q) ||
        conversation.messages.some((message) =>
          message.text.toLowerCase().includes(q)
        )
    )
  }

  createConversation(input: {
    title: string
    topic: CoachTopic
    firstUserMessage?: CoachMessage
    firstCoachMessage?: CoachMessage
  }): CoachConversation {
    const now = new Date().toISOString()
    const messages: CoachMessage[] = []
    if (input.firstUserMessage) messages.push(input.firstUserMessage)
    if (input.firstCoachMessage) messages.push(input.firstCoachMessage)

    const conversation: CoachConversation = {
      id: `conv-${Math.random().toString(36).slice(2, 10)}`,
      title: input.title,
      topic: input.topic,
      pinned: false,
      createdAt: now,
      updatedAt: now,
      messages,
    }
    this.conversations = [conversation, ...this.conversations]
    this.activeId = conversation.id
    this.persist()
    this.emit()
    return conversation
  }

  setActive(id: string | null): void {
    this.activeId = id
    this.persist()
    this.emit()
  }

  rename(id: string, title: string): void {
    const trimmed = title.trim()
    if (!trimmed) return
    this.conversations = this.conversations.map((conversation) =>
      conversation.id === id
        ? { ...conversation, title: trimmed, updatedAt: new Date().toISOString() }
        : conversation
    )
    this.persist()
    this.emit()
  }

  togglePin(id: string): void {
    this.conversations = this.conversations.map((conversation) =>
      conversation.id === id
        ? { ...conversation, pinned: !conversation.pinned }
        : conversation
    )
    this.persist()
    this.emit()
  }

  appendMessages(id: string, messages: CoachMessage[]): void {
    const now = new Date().toISOString()
    this.conversations = this.conversations.map((conversation) =>
      conversation.id === id
        ? {
            ...conversation,
            messages: [...conversation.messages, ...messages],
            updatedAt: now,
          }
        : conversation
    )
    this.persist()
    this.emit()
  }

  deleteConversation(id: string): void {
    this.conversations = this.conversations.filter(
      (conversation) => conversation.id !== id
    )
    if (this.activeId === id) {
      this.activeId = this.conversations[0]?.id ?? null
    }
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
      if (!raw) return
      const parsed = JSON.parse(raw) as PersistedShape
      if (Array.isArray(parsed.conversations)) {
        this.conversations = parsed.conversations
      }
      this.activeId = parsed.activeId ?? this.conversations[0]?.id ?? null
    } catch {
      // ignore
    }
    this.emit()
  }

  private persist(): void {
    if (typeof window === "undefined") return
    try {
      const payload: PersistedShape = {
        conversations: this.conversations,
        activeId: this.activeId,
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // ignore
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

let singleton: ConversationStore | null = null

export function getConversationStore(): ConversationStore {
  if (!singleton) singleton = new ConversationStore()
  return singleton
}

export function resetConversationStore(): void {
  singleton = null
}
