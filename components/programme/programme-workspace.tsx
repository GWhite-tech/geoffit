"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import {
  PROGRAMME_TYPE_LABELS,
  repsLabel,
  useProgrammeActions,
  useProgrammeDashboard,
  type ProgrammeWeekSessionItem,
} from "@/lib/health/programme"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function ProgrammeWorkspace() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  )
  const view = useProgrammeDashboard(selectedSessionId)
  const actions = useProgrammeActions()

  const selected =
    view.currentWeekSessions.find((item) => item.id === selectedSessionId) ??
    view.currentWeekSessions.find((item) => item.status === "due_today") ??
    null

  return (
    <div className="min-h-[calc(100svh-2.75rem)] overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.fadeUp}
        className="mx-auto flex w-full max-w-[1100px] flex-col gap-14 px-5 py-8 lg:px-10"
      >
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13px] tracking-[0.18em] text-muted-foreground uppercase">
              Training
            </p>
            <h1 className="mt-2 text-[34px] font-semibold tracking-tight text-foreground sm:text-[40px]">
              Programme
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Your active training block — coached, adaptive, and alive.
            </p>
          </div>
          <Link
            href="/training"
            className="rounded-full border border-border/50 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to Training
          </Link>
        </header>

        {!view.available || !view.header ? (
          <EmptyProgramme
            library={view.library}
            detail={view.emptyDetail}
            onActivate={actions.activate}
          />
        ) : (
          <>
            <ProgrammeHeader
              header={view.header}
              healthLabel={view.health?.label ?? null}
              onDeactivate={actions.deactivate}
            />

            <Timeline
              items={view.timeline}
              onSelectWeek={(weekNumber) => actions.setCursor(weekNumber, 0)}
            />

            <CurrentWeek
              sessions={view.currentWeekSessions}
              selectedId={selected?.id ?? null}
              onSelect={(id) => setSelectedSessionId(id)}
            />

            {selected?.planned ? (
              <SessionDetail session={selected} />
            ) : null}

            {selected?.completion ? (
              <ImportComparison completion={selected.completion} />
            ) : view.recentCompletions[0] ? (
              <ImportComparison completion={view.recentCompletions[0]} />
            ) : null}

            <AdaptiveSection items={view.adaptive} />
            <StorySection paragraphs={view.story} />
            <AnalyticsSection analytics={view.analytics} health={view.health} />
            <CoachSection items={view.coachRecommendations} />
            <HistorySection items={view.history} />
          </>
        )}
      </motion.div>
    </div>
  )
}

function EmptyProgramme({
  library,
  detail,
  onActivate,
}: {
  library: ReturnType<typeof useProgrammeDashboard>["library"]
  detail: string
  onActivate: (id: string) => void
}) {
  return (
    <div className="space-y-8">
      <p className="text-[15px] leading-relaxed text-muted-foreground">{detail}</p>
      <ul className="divide-y divide-border/25">
        {library.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 py-5"
          >
            <div>
              <p className="text-[18px] font-medium text-foreground">{item.name}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {PROGRAMME_TYPE_LABELS[item.type]} · {item.splitLabel} ·{" "}
                {item.weeks.length} weeks
              </p>
            </div>
            <button
              type="button"
              onClick={() => onActivate(item.id)}
              className="rounded-full bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground"
            >
              Start block
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ProgrammeHeader({
  header,
  healthLabel,
  onDeactivate,
}: {
  header: NonNullable<ReturnType<typeof useProgrammeDashboard>["header"]>
  healthLabel: string | null
  onDeactivate: () => void
}) {
  return (
    <section className="mc-surface-hero px-6 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionLabel>{header.goal}</SectionLabel>
          <h2 className="mt-3 text-[40px] leading-none font-semibold tracking-tight text-foreground sm:text-[48px]">
            {header.name}
          </h2>
          <p className="mt-4 text-[15px] text-muted-foreground">
            Week {header.currentWeek} · {header.phase}
            {healthLabel ? ` · ${healthLabel}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onDeactivate}
          className="rounded-full border border-border/50 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          End block
        </button>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <HeaderStat
          label="Progress"
          value={header.progressPct != null ? `${header.progressPct}%` : "—"}
        />
        <HeaderStat
          label="Completion"
          value={
            header.completionPct != null ? `${header.completionPct}%` : "—"
          }
        />
        <HeaderStat label="Next session" value={header.nextSession ?? "—"} />
        <HeaderStat label="Phase" value={header.phase} />
      </div>
    </section>
  )
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-border/25 pt-4">
      <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
        {label}
      </p>
      <p className="mt-2 text-[24px] font-semibold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  )
}

function Timeline({
  items,
  onSelectWeek,
}: {
  items: ReturnType<typeof useProgrammeDashboard>["timeline"]
  onSelectWeek: (weekNumber: number) => void
}) {
  return (
    <section className="space-y-6">
      <SectionLabel>Timeline</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {items.map((week) => (
          <button
            key={week.weekNumber}
            type="button"
            disabled={week.status === "upcoming"}
            onClick={() => {
              if (week.status !== "upcoming") onSelectWeek(week.weekNumber)
            }}
            className={cn(
              "min-w-[96px] rounded-2xl border px-4 py-4 text-left transition-colors",
              week.status === "current" &&
                "border-primary/60 bg-primary/10 text-foreground",
              week.status === "locked" &&
                "border-border/30 text-muted-foreground hover:border-border/50 hover:text-foreground",
              week.status === "upcoming" &&
                "cursor-default border-border/20 text-muted-foreground/50"
            )}
          >
            <p className="text-[12px] tracking-[0.12em] uppercase">
              Week {week.weekNumber}
            </p>
            <p className="mt-2 text-[13px]">
              {week.status === "current"
                ? "Current"
                : week.status === "locked"
                  ? "Complete"
                  : "Upcoming"}
            </p>
            {week.isDeload ? (
              <p className="mt-1 text-[11px] text-muted-foreground">Deload</p>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  )
}

function CurrentWeek({
  sessions,
  selectedId,
  onSelect,
}: {
  sessions: ProgrammeWeekSessionItem[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <section className="space-y-6">
      <div>
        <SectionLabel>Current Week</SectionLabel>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Planned sessions for this week — select one for detail.
        </p>
      </div>
      <ul className="divide-y divide-border/25">
        {sessions.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => {
                if (item.planned) onSelect(item.id)
              }}
              className={cn(
                "flex w-full flex-wrap items-baseline justify-between gap-3 py-5 text-left transition-colors",
                selectedId === item.id && "text-foreground",
                item.planned ? "hover:text-foreground" : "cursor-default"
              )}
            >
              <div>
                <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                  {item.dayLabel}
                </p>
                <p className="mt-1 text-[18px] font-medium text-foreground">
                  {item.sessionName}
                </p>
              </div>
              <p
                className={cn(
                  "text-[13px] font-medium tracking-[0.08em] uppercase",
                  item.status === "completed" && "text-success",
                  item.status === "due_today" && "text-primary",
                  item.status === "missed" && "text-warning",
                  (item.status === "upcoming" || item.status === "rest") &&
                    "text-muted-foreground"
                )}
              >
                {item.statusLabel}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function SessionDetail({ session }: { session: ProgrammeWeekSessionItem }) {
  const planned = session.planned
  if (!planned) return null

  return (
    <section className="space-y-6">
      <div>
        <SectionLabel>Session Detail</SectionLabel>
        <p className="mt-2 text-[22px] font-semibold tracking-tight text-foreground">
          {planned.name}
        </p>
        {planned.focus || planned.notes ? (
          <p className="mt-2 max-w-xl text-[15px] text-muted-foreground">
            {planned.focus ?? planned.notes}
          </p>
        ) : null}
      </div>
      <ul className="divide-y divide-border/25">
        {planned.exercises.map((exercise) => (
          <li key={exercise.id} className="py-5">
            <p className="text-[16px] font-medium text-foreground">
              {exercise.exerciseName}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
              <span>
                {exercise.sets} × {repsLabel(exercise.reps)}
              </span>
              {exercise.targetWeightKg != null ? (
                <span>{exercise.targetWeightKg} kg</span>
              ) : null}
              {exercise.targetRpe != null ? (
                <span>RPE {exercise.targetRpe}</span>
              ) : null}
              {exercise.restSeconds != null ? (
                <span>Rest {exercise.restSeconds}s</span>
              ) : null}
              {exercise.tempo ? <span>Tempo {exercise.tempo}</span> : null}
            </div>
            {exercise.notes ? (
              <p className="mt-2 text-[13px] text-muted-foreground">
                Coach note: {exercise.notes}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

function ImportComparison({
  completion,
}: {
  completion: NonNullable<
    ReturnType<typeof useProgrammeDashboard>["recentCompletions"][number]
  >
}) {
  return (
    <section className="space-y-6">
      <div>
        <SectionLabel>Planned vs Completed</SectionLabel>
        <p className="mt-2 text-[15px] text-muted-foreground">
          {completion.plannedSessionName}
          {completion.workoutName ? ` matched to ${completion.workoutName}` : ""}
        </p>
      </div>
      <div className="mc-surface-hero px-6 py-8">
        <p className="text-[48px] font-semibold tracking-tight text-foreground">
          {completion.completionPct}%
        </p>
        <p className="mt-2 text-[14px] text-muted-foreground">
          {completion.adherenceLabel} · {completion.exercisesCompleted}/
          {completion.exercisesPlanned} exercises · {completion.setsCompleted}/
          {completion.setsPlanned} sets
          {completion.volumeTargetKg != null
            ? ` · ${completion.volumeAchievedKg}/${completion.volumeTargetKg} kg`
            : ""}
        </p>
        <ul className="mt-8 divide-y divide-border/25">
          {completion.exercises.map((exercise) => (
            <li
              key={exercise.plannedExerciseId}
              className="flex flex-wrap items-baseline justify-between gap-3 py-3 text-[14px]"
            >
              <div>
                <p className="text-foreground">{exercise.exerciseName}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {exercise.detail}
                </p>
              </div>
              <p className="text-[12px] tracking-[0.08em] text-muted-foreground uppercase">
                {exercise.status}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function AdaptiveSection({
  items,
}: {
  items: ReturnType<typeof useProgrammeDashboard>["adaptive"]
}) {
  return (
    <section className="space-y-6">
      <div>
        <SectionLabel>Adaptive Progression</SectionLabel>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Recommendations only — never applied automatically.
        </p>
      </div>
      <ul className="divide-y divide-border/25">
        {items.length === 0 ? (
          <li className="py-4 text-[15px] text-muted-foreground">
            Complete matched sessions to unlock adaptive guidance.
          </li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="py-5">
              <p className="text-[12px] tracking-[0.12em] text-primary uppercase">
                {item.label}
              </p>
              <p className="mt-2 text-[16px] leading-relaxed text-foreground">
                {item.detail}
              </p>
              <p className="mt-2 text-[12px] text-muted-foreground">
                {item.evidence.join(" · ")} · {item.confidence} confidence
              </p>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}

function StorySection({
  paragraphs,
}: {
  paragraphs: ReturnType<typeof useProgrammeDashboard>["story"]
}) {
  return (
    <section className="space-y-6">
      <SectionLabel>Programme Story</SectionLabel>
      <ul className="space-y-5">
        {paragraphs.length === 0 ? (
          <li className="text-[15px] text-muted-foreground">
            Story accumulates as you train through the block.
          </li>
        ) : (
          paragraphs.map((item) => (
            <li key={item.id}>
              <p className="text-[18px] leading-relaxed text-foreground sm:text-[20px]">
                {item.body}
              </p>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}

function AnalyticsSection({
  analytics,
  health,
}: {
  analytics: ReturnType<typeof useProgrammeDashboard>["analytics"]
  health: ReturnType<typeof useProgrammeDashboard>["health"]
}) {
  if (!analytics) return null
  return (
    <section className="space-y-6">
      <div>
        <SectionLabel>Programme Analytics</SectionLabel>
        {health ? (
          <p className="mt-2 text-[15px] text-muted-foreground">
            {health.label} — {health.detail}
          </p>
        ) : null}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Completion"
          value={
            analytics.completionPct != null
              ? `${analytics.completionPct}%`
              : "—"
          }
        />
        <Stat
          label="Volume achieved"
          value={
            analytics.volumeAchievedKg != null
              ? `${analytics.volumeAchievedKg.toLocaleString("en-GB")} kg`
              : "—"
          }
        />
        <Stat
          label="Est. strength gain"
          value={
            analytics.estimatedStrengthGainPct != null
              ? `${analytics.estimatedStrengthGainPct > 0 ? "+" : ""}${analytics.estimatedStrengthGainPct}%`
              : "—"
          }
        />
        <Stat label="Weekly load" value={analytics.weeklyLoadLabel} />
        <Stat
          label="Missed sessions"
          value={String(analytics.missedSessions)}
        />
        <Stat
          label="Avg workout quality"
          value={
            analytics.averageWorkoutQuality != null
              ? String(analytics.averageWorkoutQuality)
              : "—"
          }
        />
      </div>
      {analytics.recoveryTrend ? (
        <p className="text-[14px] text-muted-foreground">
          {analytics.recoveryTrend}
        </p>
      ) : null}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-border/25 pt-4">
      <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
        {label}
      </p>
      <p className="mt-2 text-[24px] font-semibold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  )
}

function CoachSection({
  items,
}: {
  items: ReturnType<typeof useProgrammeDashboard>["coachRecommendations"]
}) {
  return (
    <section className="space-y-6">
      <SectionLabel>Coach Recommendations</SectionLabel>
      <ul className="divide-y divide-border/25">
        {items.length === 0 ? (
          <li className="py-4 text-[15px] text-muted-foreground">
            Recommendations appear as the block accumulates evidence.
          </li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="py-5">
              <p className="text-[16px] leading-relaxed text-foreground">
                {item.body}
              </p>
              <p className="mt-2 text-[13px] text-muted-foreground">
                {item.evidence}
              </p>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}

function HistorySection({
  items,
}: {
  items: ReturnType<typeof useProgrammeDashboard>["history"]
}) {
  return (
    <section className="space-y-6">
      <div>
        <SectionLabel>Programme History</SectionLabel>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Every block becomes part of Geoffit’s long-term training record.
        </p>
      </div>
      <ul className="divide-y divide-border/25">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-baseline justify-between gap-3 py-4"
          >
            <div>
              <p className="text-[15px] font-medium text-foreground">
                {item.name}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {item.detail}
              </p>
            </div>
            <p className="text-[12px] tracking-[0.08em] text-muted-foreground uppercase">
              {item.status}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
