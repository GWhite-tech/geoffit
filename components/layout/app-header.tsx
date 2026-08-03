"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SidebarTrigger } from "@/components/ui/sidebar"

interface AppHeaderProps {
  onOpenCommandPalette: () => void
}

export function AppHeader({ onOpenCommandPalette }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-11 shrink-0 items-center justify-between px-6 sm:px-8 lg:px-10">
      <SidebarTrigger className="text-muted-foreground md:hidden" />

      <div className="ml-auto flex items-center gap-6">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="text-[13px] text-muted-foreground/70 transition-colors hover:text-foreground/80"
        >
          <span className="font-mono">⌘K</span> Search
        </button>

        <Avatar size="sm" className="after:border-border/40">
          <AvatarFallback className="bg-card text-[11px] text-foreground/80">
            G
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
