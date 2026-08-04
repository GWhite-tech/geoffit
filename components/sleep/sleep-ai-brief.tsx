"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import type { SleepSummary } from "@/lib/health/sleep"
import { transitions } from "@/lib/theme"

export function SleepAiBrief({ brief }: { brief: SleepSummary["aiBrief"] }) {
  return (
    <section className="space-y-6">
      <SectionLabel>AI Sleep Brief</SectionLabel>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transitions.fadeUp, delay: 0.14 }}
        className="rounded-3xl border border-border/40 bg-gradient-to-br from-primary/[0.07] via-card/20 to-transparent px-8 py-10 sm:px-10"
      >
        {brief.paragraphs.length > 0 ? (
          <div className="space-y-5">
            {brief.paragraphs.map((paragraph) => (
              <p
                key={paragraph}
                className="max-w-3xl text-[17px] leading-[1.75] text-foreground/85"
              >
                {paragraph}
              </p>
            ))}
          </div>
        ) : (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {brief.emptyHint ??
              "Your AI Sleep Brief will appear after several nights of Sleep Analysis are imported."}
          </p>
        )}
      </motion.div>
    </section>
  )
}
