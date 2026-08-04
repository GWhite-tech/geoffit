"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import type { CorrelationInsight } from "@/lib/health/progress"
import { transitions } from "@/lib/theme"

export function CorrelationInsights({
  insights,
}: {
  insights: CorrelationInsight[]
}) {
  return (
    <section className="space-y-5">
      <div>
        <SectionLabel>Correlations</SectionLabel>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Relationships detected from your series — hypotheses, not proof.
        </p>
      </div>

      {insights.length === 0 ? (
        <p className="text-[15px] text-muted-foreground">
          More overlapping history unlocks automatic correlations between
          weight, labs, sleep, protein, and interventions.
        </p>
      ) : (
        <ul className="space-y-4">
          {insights.map((insight, index) => (
            <motion.li
              key={insight.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transitions.fadeUp, delay: index * 0.04 }}
              className="max-w-3xl"
            >
              <p className="text-[16px] leading-relaxed text-foreground">
                {insight.body}
              </p>
              <p className="mt-2 text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                {insight.strength} signal
              </p>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  )
}
