"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import type { ProgressView } from "@/lib/health/progress"
import { formatProgressDateLong } from "@/lib/health/progress"
import { transitions } from "@/lib/theme"

export function ProgressContextSidebar({ view }: { view: ProgressView }) {
  const nextProjection = view.projections.find(
    (item) => item.available && item.estimatedDateDisplay
  )
  const recentInterventions = [...view.interventions].reverse().slice(0, 6)

  return (
    <aside className="flex h-full w-full flex-col border-l border-border/30 px-5 pt-8 pb-8">
      <SectionLabel>Story</SectionLabel>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
        What changed, why it may have changed, and what the trend suggests next.
      </p>

      <div className="mt-8 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitions.fadeUp}
        >
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
            Next estimate
          </p>
          {nextProjection ? (
            <>
              <p className="mt-2 text-[18px] font-medium tracking-tight text-foreground">
                {nextProjection.label}
              </p>
              <p className="mt-1 text-[15px] text-muted-foreground">
                {nextProjection.estimatedDateDisplay}
              </p>
              <p className="mt-2 text-[12px] text-muted-foreground/80">
                {nextProjection.confidence} confidence · not a guarantee
              </p>
            </>
          ) : (
            <p className="mt-2 text-[14px] text-muted-foreground">
              Need a clearer trend before projecting.
            </p>
          )}
        </motion.div>

        <div>
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
            Recent interventions
          </p>
          {recentInterventions.length === 0 ? (
            <p className="mt-3 text-[14px] text-muted-foreground">
              None yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {recentInterventions.map((item) => (
                <li key={item.id}>
                  <p className="text-[14px] font-medium text-foreground">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {formatProgressDateLong(item.date)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {view.correlations[0] ? (
          <div>
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
              Strongest signal
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
              {view.correlations[0].body}
            </p>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
