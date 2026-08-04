"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import {
  formatProgressDateLong,
  type Milestone,
} from "@/lib/health/progress"
import { transitions } from "@/lib/theme"

export function HealthImprovements({ items }: { items: Milestone[] }) {
  return (
    <section className="space-y-5">
      <div>
        <SectionLabel>Health Improvements</SectionLabel>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Milestones crossed in your data — not a checklist.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-[15px] text-muted-foreground">
          Improvements appear as weight, labs, sleep, and nutrition thresholds
          are crossed.
        </p>
      ) : (
        <ol className="relative space-y-0 border-l border-border/40 pl-6">
          {items.map((item, index) => (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...transitions.fadeUp, delay: index * 0.03 }}
              className="relative pb-8 last:pb-0"
            >
              <span className="absolute top-1.5 -left-[1.91rem] size-2.5 rounded-full bg-primary" />
              <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                {formatProgressDateLong(item.date)}
              </p>
              <p className="mt-2 text-[18px] font-medium tracking-tight text-foreground">
                {item.title}
              </p>
              <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
                {item.detail}
              </p>
            </motion.li>
          ))}
        </ol>
      )}
    </section>
  )
}
