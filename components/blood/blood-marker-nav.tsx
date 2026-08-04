"use client"

import { useEffect, useState } from "react"
import { ChevronDown, Search } from "lucide-react"
import { motion } from "framer-motion"

import { Input } from "@/components/ui/input"
import type { BloodNavGroupId } from "@/lib/health/blood/biomarker-history"
import { useBloodNav } from "@/lib/health/blood/use-blood-markers"
import { formatBiomarkerValue } from "@/lib/health/biomarker-registry"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

const STATUS_DOT: Record<string, string> = {
  green: "bg-success",
  amber: "bg-warning",
  red: "bg-destructive",
  muted: "bg-muted-foreground/45",
}

export function BloodMarkerNav({
  activeId,
  onSelect,
}: {
  activeId: string | null
  onSelect: (biomarkerId: string) => void
}) {
  const [search, setSearch] = useState("")
  const groups = useBloodNav(search)
  const [collapsed, setCollapsed] = useState<Set<BloodNavGroupId>>(
    () => new Set()
  )

  useEffect(() => {
    if (!activeId) return
    setCollapsed((prev) => {
      const next = new Set(prev)
      for (const group of groups) {
        if (group.markers.some((m) => m.biomarker.id === activeId)) {
          next.delete(group.id)
        }
      }
      return next
    })
  }, [activeId, groups])

  function toggle(id: BloodNavGroupId) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-border/30">
      <div className="px-5 pt-8 pb-4">
        <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground/70 uppercase">
          Blood Markers
        </p>
        <div className="relative mt-4">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground/55"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search markers"
            className="h-9 border-border/40 bg-card/30 pl-9 text-[13px] shadow-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-8">
        {groups.length === 0 ? (
          <p className="px-3 py-6 text-[13px] text-muted-foreground">
            No markers match your search.
          </p>
        ) : (
          groups.map((group, index) => {
            const open = !collapsed.has(group.id)
            return (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...transitions.fadeUp, delay: index * 0.02 }}
                className="mb-1"
              >
                <button
                  type="button"
                  onClick={() => toggle(group.id)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-card/35"
                >
                  <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
                    {group.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-3.5 text-muted-foreground/55 transition-transform duration-200",
                      open && "rotate-180"
                    )}
                  />
                </button>

                {open ? (
                  <ul className="mt-0.5 space-y-0.5 pb-2">
                    {group.markers.map(({ biomarker, summary, hasData }) => {
                      const latest = summary.analytics.latest
                      const trend = summary.analytics.trendDirection
                      const active = biomarker.id === activeId
                      return (
                        <li key={biomarker.id}>
                          <button
                            type="button"
                            onClick={() => onSelect(biomarker.id)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                              active
                                ? "bg-primary/15 text-foreground"
                                : "text-foreground/90 hover:bg-card/40",
                              !hasData && "opacity-55"
                            )}
                          >
                            <span
                              className={cn(
                                "mt-0.5 size-1.5 shrink-0 rounded-full",
                                latest
                                  ? STATUS_DOT[latest.status.colour]
                                  : STATUS_DOT.muted
                              )}
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium">
                                {biomarker.shortName}
                              </span>
                              <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                                {latest
                                  ? formatBiomarkerValue(
                                      biomarker.id,
                                      latest.value
                                    )
                                  : "No data"}
                              </span>
                            </span>
                            <span
                              className={cn(
                                "shrink-0 text-[12px] tabular-nums",
                                active
                                  ? "text-primary"
                                  : "text-muted-foreground/70"
                              )}
                              aria-label={
                                trend === "up"
                                  ? "Trending up"
                                  : trend === "down"
                                    ? "Trending down"
                                    : "No change"
                              }
                            >
                              {!hasData
                                ? ""
                                : trend === "up"
                                  ? "↑"
                                  : trend === "down"
                                    ? "↓"
                                    : "–"}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </motion.div>
            )
          })
        )}
      </div>
    </aside>
  )
}
