"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { motion } from "framer-motion"

import { AddTreatmentButton } from "@/components/treatment/add-treatment-dialog"
import { Input } from "@/components/ui/input"
import { useTreatmentNav } from "@/lib/health/treatment"
import { TREATMENT_STATUS_LABELS } from "@/lib/domain/treatment"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function TreatmentNav({
  activeId,
  onSelect,
}: {
  activeId: string | null
  onSelect: (treatmentId: string) => void
}) {
  const [search, setSearch] = useState("")
  const groups = useTreatmentNav(search)

  return (
    <aside className="flex h-full w-full flex-col border-r border-border/30">
      <div className="px-5 pt-8 pb-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground/70 uppercase">
            Treatments
          </p>
          <AddTreatmentButton className="h-8 px-2.5 text-[12px]" />
        </div>
        <div className="relative mt-4">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground/55"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search treatments"
            className="h-9 border-border/40 bg-card/30 pl-9 text-[13px] shadow-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-8">
        {groups.length === 0 ? (
          <p className="px-3 py-6 text-[13px] text-muted-foreground">
            No treatments yet.
          </p>
        ) : (
          groups.map((group, index) => (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transitions.fadeUp, delay: index * 0.03 }}
              className="mb-3"
            >
              <p className="px-3 py-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.treatment.id === activeId
                  return (
                    <li key={item.treatment.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(item.treatment.id)}
                        className={cn(
                          "flex w-full flex-col gap-1 rounded-xl px-3 py-3 text-left transition-colors",
                          active
                            ? "bg-primary/15 text-foreground"
                            : "hover:bg-card/40"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-medium">
                            {item.treatment.shortName}
                          </span>
                          <span
                            className={cn(
                              "text-[11px]",
                              item.status === "active"
                                ? "text-success"
                                : "text-muted-foreground"
                            )}
                          >
                            {TREATMENT_STATUS_LABELS[item.status]}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
                          <span className="truncate">{item.doseLabel}</span>
                          <span>{item.nextDoseLabel}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground/70">
                          Supply {item.supplyLabel}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </motion.div>
          ))
        )}
      </div>
    </aside>
  )
}
