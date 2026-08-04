"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import type { ProgressView } from "@/lib/health/progress"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

const SECTIONS = [
  { id: "health-score", label: "Health Score" },
  { id: "health-story", label: "Health Story" },
  { id: "cause-effect", label: "Cause & Effect" },
  { id: "whats-changed", label: "What's Changed" },
  { id: "whats-next", label: "What's Next" },
  { id: "body-composition", label: "Body Composition" },
  { id: "improvements", label: "Improvements" },
  { id: "trends", label: "Trends" },
  { id: "correlations", label: "Correlations" },
  { id: "interventions", label: "Interventions" },
  { id: "achievements", label: "Achievements" },
  { id: "projections", label: "Projections" },
] as const

export function ProgressNav({ view }: { view: ProgressView }) {
  const score = view.healthScore

  return (
    <aside className="flex h-full w-full flex-col border-r border-border/30 px-5 pt-8 pb-8">
      <SectionLabel>Progress</SectionLabel>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.fadeUp}
        className="mt-6"
      >
        <p
          className={cn(
            "text-[56px] leading-none font-semibold tracking-tight",
            score.score == null ? "text-muted-foreground/40" : "text-foreground"
          )}
        >
          {score.score ?? "—"}
        </p>
        <p className="mt-3 text-[13px] text-muted-foreground">
          {score.score == null
            ? "Score unavailable"
            : `${score.confidenceLabel} confidence`}
        </p>
        {score.change30d != null ? (
          <p
            className={cn(
              "mt-2 text-[14px] font-medium",
              score.change30d > 0 && "text-success",
              score.change30d < 0 && "text-warning",
              score.change30d === 0 && "text-muted-foreground"
            )}
          >
            {score.change30d > 0 ? "+" : score.change30d < 0 ? "−" : ""}
            {Math.abs(score.change30d)} over 30 days
          </p>
        ) : null}
      </motion.div>

      <nav className="mt-10 space-y-1">
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="block rounded-lg px-3 py-2 text-[14px] text-muted-foreground transition-colors hover:bg-card/40 hover:text-foreground"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <p className="mt-auto pt-8 text-[12px] leading-relaxed text-muted-foreground/70">
        Open weekly. Ask one question: am I getting healthier?
      </p>
    </aside>
  )
}
