"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import type { HealthScoreResult } from "@/lib/health/progress"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function HealthScoreHero({ score }: { score: HealthScoreResult }) {
  const change =
    score.change30d == null
      ? null
      : score.change30d > 0
        ? `+${score.change30d}`
        : score.change30d < 0
          ? `−${Math.abs(score.change30d)}`
          : "0"

  return (
    <section className="space-y-5">
      <SectionLabel>Health Score</SectionLabel>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.fadeUp}
        className="mc-surface-hero px-6 py-10 sm:px-10 sm:py-14"
      >
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p
              className={cn(
                "text-[88px] leading-none font-semibold tracking-tight sm:text-[112px]",
                score.score == null ? "text-muted-foreground/40" : "text-foreground"
              )}
            >
              {score.score ?? "—"}
            </p>
            <p className="mt-4 text-[18px] font-medium tracking-tight text-foreground">
              Overall Health Score
            </p>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              {score.explanation}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-10 gap-y-5 sm:grid-cols-3">
            <Stat
              label="Current"
              value={score.score != null ? String(score.score) : "—"}
            />
            <Stat
              label="30-day change"
              value={change ?? "—"}
              tone={
                score.change30d == null
                  ? "muted"
                  : score.change30d > 0
                    ? "good"
                    : score.change30d < 0
                      ? "bad"
                      : "muted"
              }
            />
            <Stat
              label="Confidence"
              value={
                score.score == null
                  ? "—"
                  : `${score.confidenceLabel} · ${score.confidence}%`
              }
            />
          </dl>
        </div>

        {score.components.some((component) => component.available) ? (
          <ul className="mt-10 flex flex-wrap gap-2">
            {score.components
              .filter((component) => component.available && component.score != null)
              .map((component) => (
                <li
                  key={component.id}
                  className="rounded-full border border-border/40 px-3 py-1 text-[12px] text-muted-foreground"
                  title={component.note ?? undefined}
                >
                  {component.label}{" "}
                  <span className="text-foreground/80">{component.score}</span>
                </li>
              ))}
          </ul>
        ) : null}
      </motion.div>
    </section>
  )
}

function Stat({
  label,
  value,
  tone = "muted",
}: {
  label: string
  value: string
  tone?: "muted" | "good" | "bad"
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-2 text-[22px] font-medium tracking-tight",
          tone === "good" && "text-success",
          tone === "bad" && "text-destructive",
          tone === "muted" && "text-foreground"
        )}
      >
        {value}
      </dd>
    </div>
  )
}
