"use client"

import { SectionLabel } from "@/components/ui/section-label"
import type { TrainingView } from "@/lib/health/training"
import { cn } from "@/lib/utils"

function TargetRow({
  label,
  current,
  target,
  unit,
}: {
  label: string
  current: number | null
  target: number
  unit: string
}) {
  const value = current ?? 0
  const pct = Math.min(100, Math.round((value / Math.max(1, target)) * 100))
  return (
    <div className="space-y-2 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[14px] text-foreground">{label}</p>
        <p className="text-[13px] text-muted-foreground">
          {current == null ? "—" : current}
          <span className="text-muted-foreground/70">
            {" "}
            / {target} {unit}
          </span>
        </p>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-border/40">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function TrainingContextSidebar({ view }: { view: TrainingView }) {
  const targets = view.weeklyTargets

  return (
    <aside className="flex h-full w-full flex-col border-l border-border/30 px-5 pt-8 pb-8">
      <SectionLabel>Weekly Targets</SectionLabel>
      <div className="mt-2 divide-y divide-border/20">
        <TargetRow
          label="Strength"
          current={targets.strength.current}
          target={targets.strength.target}
          unit={targets.strength.unit}
        />
        <TargetRow
          label="Cardio"
          current={targets.cardio.current}
          target={targets.cardio.target}
          unit={targets.cardio.unit}
        />
        <TargetRow
          label="Steps"
          current={targets.steps.current}
          target={targets.steps.target}
          unit={targets.steps.unit}
        />
        <TargetRow
          label="Recovery"
          current={targets.recovery.current}
          target={targets.recovery.target}
          unit={targets.recovery.unit}
        />
      </div>

      <SectionLabel className="mt-10">Upcoming</SectionLabel>
      <ul className="mt-4 space-y-4">
        {view.upcoming.map((item) => (
          <li key={item.id}>
            <p className="text-[14px] font-medium text-foreground">
              {item.title}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {item.detail}
            </p>
          </li>
        ))}
      </ul>

      <SectionLabel className="mt-10">Training insights</SectionLabel>
      <ul className="mt-4 space-y-4">
        {view.insights.length === 0 ? (
          <li className="text-[13px] leading-relaxed text-muted-foreground">
            Insights appear as strength, cardio, and step history builds.
          </li>
        ) : (
          view.insights.slice(0, 4).map((insight) => (
            <li key={insight.id}>
              <p className="text-[13px] leading-relaxed text-foreground/90">
                {insight.body}
              </p>
              <p
                className={cn(
                  "mt-1 text-[11px] tracking-[0.12em] uppercase",
                  "text-muted-foreground/70"
                )}
              >
                {insight.confidence} confidence
              </p>
            </li>
          ))
        )}
      </ul>
    </aside>
  )
}
