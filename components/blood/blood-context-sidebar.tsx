"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import { getHealthStore } from "@/lib/health"
import { buildBloodHealthContext } from "@/lib/health/blood/health-context"
import { useHealthAndBloodVersion } from "@/lib/health/blood/use-blood-markers"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function BloodContextSidebar() {
  const version = useHealthAndBloodVersion()
  const cards = useMemo(() => {
    // version 0 = health not hydrated yet — skip full-record walks.
    if (version === 0) return buildBloodHealthContext([])
    return buildBloodHealthContext(getHealthStore().getAll())
  }, [version])

  return (
    <aside className="flex h-full w-full flex-col border-l border-border/30 px-5 pt-8 pb-8">
      <SectionLabel>Health context</SectionLabel>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
        Related signals that help explain blood marker changes.
      </p>

      <ul className="mt-6 space-y-2.5">
        {cards.map((card, index) => (
          <motion.li
            key={card.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transitions.fadeUp, delay: 0.04 + index * 0.03 }}
            className="mc-card px-4 py-3.5"
          >
            <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground/70 uppercase">
              {card.label}
            </p>
            <p
              className={cn(
                "mt-2 text-[18px] leading-none font-medium tracking-tight",
                card.available
                  ? "text-foreground"
                  : "text-muted-foreground/45"
              )}
            >
              {card.value}
            </p>
          </motion.li>
        ))}
      </ul>
    </aside>
  )
}
