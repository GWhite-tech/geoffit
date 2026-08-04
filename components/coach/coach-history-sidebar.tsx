"use client"

import { useMemo, useState } from "react"
import { Pin, Plus, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { SectionLabel } from "@/components/ui/section-label"
import {
  deleteConversation,
  renameConversation,
  selectConversation,
  startNewConversation,
  togglePinConversation,
  useActiveConversation,
  useCoachConversations,
} from "@/lib/health/coach"
import { cn } from "@/lib/utils"

function dayGroup(iso: string): string {
  const day = iso.slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  if (day === today) return "Today"
  if (day === yesterday) return "Yesterday"
  const time = Date.parse(`${day}T12:00:00.000Z`)
  if (Number.isNaN(time)) return day
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(time))
}

export function CoachHistorySidebar() {
  const [search, setSearch] = useState("")
  const conversations = useCoachConversations(search)
  const active = useActiveConversation()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")

  const groups = useMemo(() => {
    const map = new Map<string, typeof conversations>()
    for (const conversation of conversations) {
      const key = dayGroup(conversation.updatedAt)
      const list = map.get(key) ?? []
      list.push(conversation)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [conversations])

  return (
    <aside className="flex h-full w-full flex-col border-r border-border/30">
      <div className="space-y-4 px-5 pt-8 pb-4">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>Conversations</SectionLabel>
          <button
            type="button"
            onClick={() => startNewConversation()}
            className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card/50 hover:text-foreground"
            aria-label="New conversation"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search"
            className="h-9 border-border/40 bg-card/20 pl-9 text-[13px]"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-8">
        {groups.length === 0 ? (
          <p className="px-2 pt-4 text-[13px] leading-relaxed text-muted-foreground">
            Ask a question to start. Conversations are grouped by day.
          </p>
        ) : (
          groups.map(([label, items]) => (
            <div key={label} className="mb-5">
              <p className="px-2 pb-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
                {label}
              </p>
              <ul className="space-y-0.5">
                {items.map((conversation) => {
                  const selected = active?.id === conversation.id
                  return (
                    <li key={conversation.id} className="group relative">
                      {editingId === conversation.id ? (
                        <input
                          autoFocus
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          onBlur={() => {
                            renameConversation(conversation.id, draft)
                            setEditingId(null)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              renameConversation(conversation.id, draft)
                              setEditingId(null)
                            }
                            if (event.key === "Escape") setEditingId(null)
                          }}
                          className="w-full rounded-lg border border-border/50 bg-card/40 px-3 py-2 text-[13px] text-foreground outline-none"
                        />
                      ) : (
                        <div
                          className={cn(
                            "flex items-center gap-1 rounded-lg transition-colors",
                            selected
                              ? "bg-card/60"
                              : "hover:bg-card/30"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => selectConversation(conversation.id)}
                            onDoubleClick={() => {
                              setEditingId(conversation.id)
                              setDraft(conversation.title)
                            }}
                            className={cn(
                              "flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left",
                              selected
                                ? "text-foreground"
                                : "text-muted-foreground group-hover:text-foreground"
                            )}
                          >
                            {conversation.pinned ? (
                              <Pin className="size-3 shrink-0 text-primary" />
                            ) : null}
                            <span className="truncate text-[13px] font-medium">
                              {conversation.title}
                            </span>
                          </button>
                          <div className="hidden shrink-0 items-center gap-1 pr-2 group-hover:flex">
                            <button
                              type="button"
                              onClick={() =>
                                togglePinConversation(conversation.id)
                              }
                              className="text-[10px] tracking-wide text-muted-foreground uppercase hover:text-foreground"
                            >
                              Pin
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                deleteConversation(conversation.id)
                              }
                              className="text-[10px] tracking-wide text-muted-foreground uppercase hover:text-foreground"
                            >
                              Del
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
