"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import type { WhatsNextItem } from "@/lib/health/progress"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function WhatsNext({ items }: { items: WhatsNextItem[] }) {
  const dated = items.filter((item) => item.available)
  const unavailable = items.filter((item) => !item.available)

  return (
    <section className="space-y-8">
      <div>
        <SectionLabel>What&apos;s Next?</SectionLabel>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          At your current trend — estimates only. Never certainty.
        </p>
      </div>

      {dated.length === 0 && unavailable.length === 0 ? (
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Projections appear once trends are stable enough to extrapolate.
        </p>
      ) : (
        <ul className="max-w-2xl space-y-10">
          {dated.map((item, index) => (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transitions.fadeUp, delay: index * 0.04 }}
              className="space-y-2"
            >
              <p className="text-[16px] text-muted-foreground">{item.headline}</p>
              <p className="text-[28px] font-medium tracking-tight text-foreground">
                Estimated {item.estimatedDisplay}
              </p>
              <p
                className={cn(
                  "text-[13px]",
                  item.confidence === "High" && "text-success",
                  item.confidence === "Medium" && "text-warning",
                  item.confidence === "Low" && "text-muted-foreground"
                )}
              >
                Confidence · {item.confidence}
              </p>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {item.note}
              </p>
            </motion.li>
          ))}

          {unavailable.map((item) => (
            <li key={item.id} className="space-y-2 opacity-70">
              <p className="text-[16px] text-muted-foreground">{item.headline}</p>
              <p className="text-[18px] text-muted-foreground">Unavailable</p>
              <p className="text-[13px] text-muted-foreground">
                Confidence · {item.confidence}
              </p>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {item.note}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
