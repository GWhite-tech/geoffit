"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { navSections } from "@/lib/dashboard-data"
import { cn } from "@/lib/utils"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const commandGroups = navSections.map((section) => ({
  label: section.label,
  items: section.items,
}))

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("")

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        onOpenChange(!open)
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) {
      setQuery("")
    }
  }, [open])

  const normalizedQuery = query.trim().toLowerCase()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Command palette</DialogTitle>
          <DialogDescription>Search and navigate Geoffit</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b border-foreground/[0.06] px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages and actions…"
            className="h-12 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            autoFocus
          />
        </div>

        <ScrollArea className="max-h-80">
          <div className="p-2">
            {commandGroups.map((group) => {
              const items = group.items.filter((item) =>
                item.label.toLowerCase().includes(normalizedQuery)
              )

              if (items.length === 0) {
                return null
              }

              return (
                <div key={group.label} className="mb-2 last:mb-0">
                  <p className="px-2 py-1.5 text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
                    {group.label}
                  </p>
                  <ul>
                    {items.map((item) => (
                      <li key={item.label}>
                        <Link
                          href={item.href}
                          onClick={() => onOpenChange(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors",
                            "hover:bg-foreground/[0.05]"
                          )}
                        >
                          <item.icon className="size-4 text-muted-foreground" />
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
