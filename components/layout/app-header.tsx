"use client"

import Link from "next/link"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useProfile, useUser } from "@/hooks/auth"

interface AppHeaderProps {
  onOpenCommandPalette: () => void
}

function initials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
  }
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase()
  return (email || "G").slice(0, 2).toUpperCase()
}

export function AppHeader({ onOpenCommandPalette }: AppHeaderProps) {
  const { user } = useUser()
  const { profile, greetingName } = useProfile()
  const display =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    greetingName
  const email = profile?.email ?? user?.email ?? ""

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

        <Link href="/account" aria-label="Account">
          <Avatar size="sm" className="after:border-border/40">
            {profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={display} />
            ) : null}
            <AvatarFallback className="bg-card text-[11px] text-foreground/80">
              {initials(display, email)}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  )
}
