"use client"

import { useState } from "react"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

import { AppHeader } from "./app-header"
import { AppSidebar } from "./app-sidebar"
import { BottomNavigation } from "./bottom-navigation"
import { CommandPalette } from "./command-palette"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [commandOpen, setCommandOpen] = useState(false)

  return (
    <SidebarProvider defaultOpen>
      <div className="hidden md:contents">
        <AppSidebar />
      </div>
      <SidebarInset className="min-h-svh pb-16 md:pb-0">
        <AppHeader onOpenCommandPalette={() => setCommandOpen(true)} />
        <main className="dashboard-grid-bg flex-1">{children}</main>
      </SidebarInset>
      <BottomNavigation />
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </SidebarProvider>
  )
}
