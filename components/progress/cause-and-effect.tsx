"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import type { CauseEffectItem } from "@/lib/health/progress"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function CauseAndEffect({ items }: { items: CauseEffectItem[] }) {
  return (
    <section className="space-y-8">
      <div>
        <SectionLabel>Cause &amp; Effect</SectionLabel>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Possible contributors to meaningful trends — hypotheses with
          confidence, not proof.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          When a clear trend appears alongside interventions or behaviour
          shifts, possible contributors show up here.
        </p>
      ) : (
        <ul className="max-w-2xl space-y-10">
          {items.map((item, index) => (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transitions.fadeUp, delay: index * 0.04 }}
              className="space-y-4"
            >
              <p className="text-[20px] font-medium tracking-tight text-foreground">
                {item.effect}
              </p>
              <div>
                <p className="text-[12px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
                  Possible contributors
                </p>
                <ul className="mt-3 space-y-2">
                  {item.contributors.map((contributor) => (
                    <li
                      key={contributor}
                      className="text-[15px] leading-relaxed text-foreground/90"
                    >
                      {contributor}
                    </li>
                  ))}
                </ul>
              </div>
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
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  )
}
