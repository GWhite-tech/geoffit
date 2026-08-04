"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import type { ProjectionEstimate } from "@/lib/health/progress"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function FutureProjection({
  projections,
}: {
  projections: ProjectionEstimate[]
}) {
  return (
    <section className="space-y-5">
      <div>
        <SectionLabel>Future Projection</SectionLabel>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Estimates from current trends. Never certainty — confidence is shown
          explicitly.
        </p>
      </div>

      <ul className="space-y-6">
        {projections.map((item, index) => (
          <motion.li
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transitions.fadeUp, delay: index * 0.03 }}
            className="max-w-2xl"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-[16px] font-medium text-foreground">
                {item.label}
              </p>
              <p
                className={cn(
                  "text-[12px] tracking-[0.12em] uppercase",
                  item.confidence === "high" && "text-success",
                  item.confidence === "moderate" && "text-warning",
                  item.confidence === "low" && "text-muted-foreground"
                )}
              >
                {item.confidence} confidence
              </p>
            </div>
            <p className="mt-2 text-[28px] font-medium tracking-tight text-foreground">
              {item.available
                ? (item.estimatedDateDisplay ?? item.targetDisplay)
                : "—"}
            </p>
            {item.available && item.estimatedDateDisplay ? (
              <p className="mt-1 text-[14px] text-muted-foreground">
                Toward {item.targetDisplay}
              </p>
            ) : null}
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {item.note}
            </p>
          </motion.li>
        ))}
      </ul>
    </section>
  )
}
