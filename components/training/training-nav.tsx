"use client"

import { SectionLabel } from "@/components/ui/section-label"
import type { TrainingView } from "@/lib/health/training"
import { cn } from "@/lib/utils"

const SECTIONS = [
  { id: "training-score", label: "Training Score" },
  { id: "training-story", label: "Training Story" },
  { id: "next-best-session", label: "Next Best Session" },
  { id: "programme", label: "Programme" },
  { id: "volume-planner", label: "Volume Planner" },
  { id: "exercise-rotation", label: "Exercise Rotation" },
  { id: "training-balance", label: "Training Balance" },
  { id: "personal-best-opportunities", label: "PR Opportunities" },
  { id: "weekly-plan", label: "Weekly Plan" },
  { id: "training-goals", label: "Training Goals" },
  { id: "strength", label: "Strength" },
  { id: "exercise", label: "Exercise Progression" },
  { id: "muscle-groups", label: "Muscle Balance" },
  { id: "workout-quality", label: "Workout Quality" },
  { id: "cardio-intelligence", label: "Cardio Intelligence" },
  { id: "recovery-readiness", label: "Training Readiness" },
  { id: "programme-adherence", label: "Programme Adherence" },
  { id: "exercise-insights", label: "Exercise Insights" },
  { id: "cardio", label: "Cardio" },
  { id: "steps", label: "Daily Steps" },
  { id: "load", label: "Training Load" },
  { id: "recovery-performance", label: "Recovery vs Performance" },
  { id: "prs", label: "Personal Records" },
  { id: "timeline", label: "Timeline" },
  { id: "insights", label: "Insights" },
  { id: "forecast", label: "Forecast" },
] as const

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="border-t border-border/25 py-4">
      <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
        {label}
      </p>
      <p className="mt-1.5 text-[22px] font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export function TrainingNav({ view }: { view: TrainingView }) {
  const summary = view.summary

  return (
    <aside className="flex h-full w-full flex-col border-r border-border/30 px-5 pt-8 pb-8">
      <SectionLabel>Training Summary</SectionLabel>

      <div className="mt-6">
        <p
          className={cn(
            "text-[56px] leading-none font-semibold tracking-tight",
            summary.trainingScore == null
              ? "text-muted-foreground/40"
              : "text-foreground"
          )}
        >
          {summary.trainingScore ?? "—"}
        </p>
        <p className="mt-3 text-[13px] text-muted-foreground">
          Training Score
        </p>
      </div>

      <div className="mt-4">
        <Stat
          label="Weekly Volume"
          value={
            summary.weeklyVolumeKg != null
              ? `${summary.weeklyVolumeKg.toLocaleString("en-GB")} kg`
              : "—"
          }
        />
        <Stat label="Workout Streak" value={`${summary.workoutStreak} days`} />
        <Stat
          label="Current Split"
          value={summary.currentSplit ?? "—"}
        />
        <Stat
          label="Strength this week"
          value={`${summary.strengthSessionsThisWeek}`}
        />
        <Stat
          label="Cardio this week"
          value={`${summary.cardioSessionsThisWeek}`}
        />
        <Stat
          label="Steps this week"
          value={
            summary.stepsThisWeek != null
              ? summary.stepsThisWeek.toLocaleString("en-GB")
              : "—"
          }
        />
        <Stat
          label="Average Recovery"
          value={
            summary.averageRecovery != null
              ? `${summary.averageRecovery}%`
              : "—"
          }
        />
      </div>

      <nav className="mt-8 space-y-1">
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
        Ask three questions: stronger? fitter? consistent?
      </p>
    </aside>
  )
}
