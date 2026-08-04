"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import {
  formatProgressDateLong,
  type InterventionMarker,
} from "@/lib/health/progress"
import { transitions } from "@/lib/theme"

export function InterventionsSection({
  interventions,
}: {
  interventions: InterventionMarker[]
}) {
  const recent = [...interventions].reverse().slice(0, 24)

  return (
    <section className="space-y-5">
      <div>
        <SectionLabel>Interventions</SectionLabel>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Life events overlaid on charts — medication starts, dose changes, and
          blood tests.
        </p>
      </div>

      {recent.length === 0 ? (
        <p className="text-[15px] text-muted-foreground">
          Add treatments or import blood tests to mark interventions on your
          trends.
        </p>
      ) : (
        <ul className="space-y-3">
          {recent.map((item, index) => (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transitions.fadeUp, delay: index * 0.02 }}
              className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border/20 py-3 last:border-0"
            >
              <span className="w-28 shrink-0 text-[12px] text-muted-foreground">
                {formatProgressDateLong(item.date)}
              </span>
              <span className="text-[15px] font-medium text-foreground">
                {item.label}
              </span>
              {item.detail ? (
                <span className="text-[13px] text-muted-foreground">
                  {item.detail}
                </span>
              ) : null}
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  )
}
