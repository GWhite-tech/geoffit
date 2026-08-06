"use client"

import { useState } from "react"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useTabScrollRestoration } from "@/hooks/use-tab-scroll-restoration"

import { AppHeader } from "./app-header"
import { AppSidebar } from "./app-sidebar"
import { BottomNavigation } from "./bottom-navigation"
import { CommandPalette } from "./command-palette"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [commandOpen, setCommandOpen] = useState(false)
  useTabScrollRestoration()

  return (
    <SidebarProvider defaultOpen>
      <div className="hidden md:contents">
        <AppSidebar />
      </div>
      <SidebarInset className="min-h-svh bg-background pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <div className="hidden md:block">
          <AppHeader onOpenCommandPalette={() => setCommandOpen(true)} />
        </div>
        <main className="app-canvas flex-1 pt-[env(safe-area-inset-top)]">
          {children}
        </main>
      </SidebarInset>
      <BottomNavigation />
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </SidebarProvider>
  )
}
