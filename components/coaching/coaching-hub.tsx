"use client"

import { useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { MyClientsPanel } from "@/components/coaching/my-clients-panel"
import { MyCoachesPanel } from "@/components/coaching/my-coaches-panel"
import { cn } from "@/lib/utils"

type Tab = "coaches" | "clients"

export function CoachingHub() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab: Tab = useMemo(() => {
    const raw = searchParams.get("tab")
    return raw === "clients" ? "clients" : "coaches"
  }, [searchParams])

  function setTab(next: Tab) {
    const params = new URLSearchParams(searchParams.toString())
    if (next === "coaches") params.delete("tab")
    else params.set("tab", next)
    const q = params.toString()
    router.replace(q ? `/coaching?${q}` : "/coaching")
  }

  return (
    <div className="flex h-[calc(100svh-2.75rem)] w-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border/30 px-4 pt-4 md:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Coaching
        </h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Manage Coaches who can see your data, or open clients who invited you.
        </p>
        <div className="mt-4 flex gap-1">
          <TabButton
            active={tab === "coaches"}
            onClick={() => setTab("coaches")}
            label="My Coaches"
          />
          <TabButton
            active={tab === "clients"}
            onClick={() => setTab("clients")}
            label="My Clients"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "coaches" ? <MyCoachesPanel /> : <MyClientsPanel />}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-t-lg px-4 py-2.5 text-[14px] font-medium transition-colors",
        active
          ? "bg-card/40 text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  )
}
