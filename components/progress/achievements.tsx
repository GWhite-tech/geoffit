"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import {
  formatProgressDateLong,
  type Milestone,
} from "@/lib/health/progress"
import { transitions } from "@/lib/theme"

export function Achievements({ items }: { items: Milestone[] }) {
  return (
    <section className="space-y-5">
      <div>
        <SectionLabel>Achievements</SectionLabel>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Automatically generated from imported history.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-[15px] text-muted-foreground">
          Achievements unlock as cumulative change accumulates — weight lost,
          workouts logged, labs improved.
        </p>
      ) : (
        <ul className="space-y-5">
          {items.map((item, index) => (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transitions.fadeUp, delay: index * 0.03 }}
            >
              <p className="text-[20px] font-medium tracking-tight text-foreground">
                {item.title}
              </p>
              <p className="mt-1 text-[14px] text-muted-foreground">
                {item.detail}
              </p>
              <p className="mt-2 text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                {formatProgressDateLong(item.date)}
              </p>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  )
}
