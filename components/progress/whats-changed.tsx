"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import type { WhatsChangedItem } from "@/lib/health/progress"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function WhatsChanged({ items }: { items: WhatsChangedItem[] }) {
  return (
    <section className="space-y-8">
      <div>
        <SectionLabel>What&apos;s Changed?</SectionLabel>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          The biggest shifts versus the previous period of the same length.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Need overlapping history in two consecutive periods to rank what
          moved most.
        </p>
      ) : (
        <ul className="max-w-xl space-y-6">
          {items.map((item, index) => (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transitions.fadeUp, delay: index * 0.03 }}
              className="flex items-baseline justify-between gap-6"
            >
              <span className="text-[16px] text-muted-foreground">
                {item.label}
              </span>
              <span
                className={cn(
                  "text-[28px] font-medium tracking-tight tabular-nums",
                  item.improving === true && "text-success",
                  item.improving === false && "text-warning",
                  item.improving == null && "text-foreground"
                )}
              >
                {item.changeDisplay}
              </span>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  )
}
