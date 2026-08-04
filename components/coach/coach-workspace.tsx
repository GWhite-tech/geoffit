"use client"

import { CoachContextSidebar } from "@/components/coach/coach-context-sidebar"
import { CoachConversation } from "@/components/coach/coach-conversation"
import { CoachHistorySidebar } from "@/components/coach/coach-history-sidebar"
import { useCoachBootstrap } from "@/lib/health/coach"

export function CoachWorkspace() {
  useCoachBootstrap()

  return (
    <div className="flex h-[calc(100svh-2.75rem)] w-full overflow-hidden">
      <div className="hidden h-full w-[280px] shrink-0 overflow-hidden lg:block">
        <CoachHistorySidebar />
      </div>

      <div className="min-w-0 flex-1 overflow-hidden">
        <CoachConversation />
      </div>

      <div className="hidden h-full w-[280px] shrink-0 overflow-y-auto xl:block">
        <CoachContextSidebar />
      </div>
    </div>
  )
}
