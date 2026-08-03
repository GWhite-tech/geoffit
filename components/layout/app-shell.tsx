"use client"

import { useState } from "react"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

import { AppHeader } from "./app-header"
import { AppSidebar } from "./app-sidebar"
import { CommandPalette } from "./command-palette"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [commandOpen, setCommandOpen] = useState(false)

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset className="min-h-svh">
        <AppHeader onOpenCommandPalette={() => setCommandOpen(true)} />
        <main className="dashboard-grid-bg flex-1">{children}</main>
      </SidebarInset>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </SidebarProvider>
  )
}
