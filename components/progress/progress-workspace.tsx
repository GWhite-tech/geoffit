"use client"

import { motion } from "framer-motion"

import { Achievements } from "@/components/progress/achievements"
import { BodyCompositionChart } from "@/components/progress/body-composition-chart"
import { CauseAndEffect } from "@/components/progress/cause-and-effect"
import { CorrelationInsights } from "@/components/progress/correlation-insights"
import { FutureProjection } from "@/components/progress/future-projection"
import { HealthImprovements } from "@/components/progress/health-improvements"
import { HealthScoreHero } from "@/components/progress/health-score-hero"
import { HealthStory } from "@/components/progress/health-story"
import { InterventionsSection } from "@/components/progress/interventions-section"
import { ProgressContextSidebar } from "@/components/progress/progress-context-sidebar"
import { ProgressNav } from "@/components/progress/progress-nav"
import { TrendCards } from "@/components/progress/trend-cards"
import { WhatsChanged } from "@/components/progress/whats-changed"
import { WhatsNext } from "@/components/progress/whats-next"
import {
  downloadProgressExport,
  useProgress,
  useProgressRange,
  type ProgressRange,
} from "@/lib/health/progress"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

const RANGES: { id: ProgressRange; label: string }[] = [
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "6m", label: "6M" },
  { id: "1y", label: "1Y" },
  { id: "all", label: "All Time" },
]

export function ProgressWorkspace() {
  const { range, setRange } = useProgressRange()
  const view = useProgress(range)

  return (
    <div className="flex h-[calc(100svh-2.75rem)] w-full overflow-hidden">
      <div className="hidden h-full w-[260px] shrink-0 overflow-y-auto lg:block">
        <ProgressNav view={view} />
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitions.fadeUp}
          className="mx-auto flex w-full max-w-[1100px] flex-col gap-16 px-5 py-8 lg:px-10"
        >
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[34px] font-semibold tracking-tight text-foreground sm:text-[40px]">
                Progress
              </h1>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                Am I getting healthier? Longitudinal story — not another
                dashboard.
              </p>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:items-end">
              <div className="flex flex-wrap gap-0.5">
                {RANGES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRange(item.id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                      range === item.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => downloadProgressExport(view)}
                className="self-end rounded-full border border-border/50 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Export
              </button>
            </div>
          </header>

          {!view.hasData ? (
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Import Apple Health, blood tests, nutrition, and treatments to see
              whether your health is improving over time.
            </p>
          ) : null}

          <div id="health-score">
            <HealthScoreHero score={view.healthScore} />
          </div>
          <div id="health-story">
            <HealthStory chapters={view.healthStory} />
          </div>
          <div id="cause-effect">
            <CauseAndEffect items={view.causeAndEffect} />
          </div>
          <div id="whats-changed">
            <WhatsChanged items={view.whatsChanged} />
          </div>
          <div id="whats-next">
            <WhatsNext items={view.whatsNext} />
          </div>
          <div id="body-composition">
            <BodyCompositionChart
              series={view.bodyComposition.series}
              interventions={view.bodyComposition.interventions}
            />
          </div>
          <div id="improvements">
            <HealthImprovements items={view.improvements} />
          </div>
          <div id="trends">
            <TrendCards cards={view.trends} />
          </div>
          <div id="correlations">
            <CorrelationInsights insights={view.correlations} />
          </div>
          <div id="interventions">
            <InterventionsSection interventions={view.interventions} />
          </div>
          <div id="achievements">
            <Achievements items={view.achievements} />
          </div>
          <div id="projections" className="pb-10">
            <FutureProjection projections={view.projections} />
          </div>
        </motion.div>
      </div>

      <div className="hidden h-full w-[280px] shrink-0 overflow-y-auto xl:block">
        <ProgressContextSidebar view={view} />
      </div>
    </div>
  )
}
