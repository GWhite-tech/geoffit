"use client"

import Link from "next/link"

import { SectionLabel } from "@/components/ui/section-label"
import type { TrainingView } from "@/lib/health/training"
import { PROGRAMME_TYPE_LABELS } from "@/lib/health/programme"
import { cn } from "@/lib/utils"

const STATUS_LABEL: Record<string, string> = {
  completed: "Completed",
  skipped: "Skipped",
  modified: "Modified",
  exceeded: "Exceeded",
  partial: "Partial",
}

export function ProgrammeSection({
  view,
  onActivate,
  onDeactivate,
}: {
  view: TrainingView
  onActivate: (programmeId: string) => void
  onDeactivate: () => void
}) {
  const programme = view.programme
  const next = view.planning.nextBestSession

  return (
    <section id="programme" className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionLabel>Programme</SectionLabel>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Structured weeks, sessions, and targets — matched against Hevy imports.
          </p>
        </div>
        <Link
          href="/training/programme"
          className="rounded-full border border-border/50 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Open Programme
        </Link>
      </div>

      {!programme.available || !programme.active ? (
        <div className="space-y-4">
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {programme.detail}
          </p>
          <ul className="divide-y divide-border/25">
            {programme.library.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <p className="text-[15px] font-medium text-foreground">
                    {item.name}
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {PROGRAMME_TYPE_LABELS[item.type]} · {item.splitLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onActivate(item.id)}
                  className="rounded-full border border-border/50 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Activate
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <div className="mc-surface-hero px-6 py-8 sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                  Active programme
                </p>
                <p className="mt-2 text-[28px] font-semibold tracking-tight text-foreground">
                  {programme.active.name}
                </p>
                <p className="mt-2 text-[14px] text-muted-foreground">
                  {programme.detail}
                  {programme.adherencePct != null
                    ? ` · ${programme.adherencePct}% session completion`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={onDeactivate}
                className="rounded-full border border-border/50 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Deactivate
              </button>
            </div>

            {next.fromProgramme ? (
              <div className="mt-8 border-t border-border/25 pt-6">
                <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                  Next planned session
                </p>
                <p className="mt-2 text-[22px] font-semibold text-foreground">
                  {next.title}
                </p>
                <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
                  {next.why[0]}
                </p>
              </div>
            ) : null}
          </div>

          <div>
            <SectionLabel>Planned vs Completed</SectionLabel>
            <ul className="mt-4 divide-y divide-border/25">
              {programme.recentCompletions.length === 0 ? (
                <li className="py-4 text-[15px] text-muted-foreground">
                  Import a Hevy workout that matches a planned session to see completion.
                </li>
              ) : (
                programme.recentCompletions.map((completion) => (
                  <li key={completion.id} className="space-y-3 py-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <div>
                        <p className="text-[15px] font-medium text-foreground">
                          {completion.plannedSessionName}
                        </p>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          {completion.workoutName
                            ? `Matched ${completion.workoutName}`
                            : "Unmatched"}
                          {completion.workoutDate
                            ? ` · ${completion.workoutDate}`
                            : ""}
                        </p>
                      </div>
                      <p className="text-[22px] font-semibold text-foreground">
                        {completion.completionPct}%
                      </p>
                    </div>
                    <p className="text-[13px] text-muted-foreground">
                      {completion.adherenceLabel} · {completion.exercisesCompleted}/
                      {completion.exercisesPlanned} exercises ·{" "}
                      {completion.setsCompleted}/{completion.setsPlanned} sets
                      {completion.volumeTargetKg != null
                        ? ` · ${completion.volumeAchievedKg}/${completion.volumeTargetKg} kg`
                        : ""}
                    </p>
                    <ul className="space-y-2">
                      {completion.exercises.map((exercise) => (
                        <li
                          key={exercise.plannedExerciseId}
                          className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]"
                        >
                          <span className="text-foreground">
                            {exercise.exerciseName}
                          </span>
                          <span
                            className={cn(
                              "tracking-[0.08em] uppercase",
                              exercise.status === "completed" && "text-success",
                              exercise.status === "exceeded" && "text-primary",
                              exercise.status === "skipped" && "text-warning",
                              exercise.status === "modified" &&
                                "text-muted-foreground",
                              exercise.status === "partial" && "text-warning"
                            )}
                          >
                            {STATUS_LABEL[exercise.status] ?? exercise.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))
              )}
            </ul>
          </div>

          {programme.progression.length > 0 ? (
            <div>
              <SectionLabel>Progression</SectionLabel>
              <ul className="mt-4 divide-y divide-border/25">
                {programme.progression.map((item) => (
                  <li key={`${item.exerciseName}-${item.ruleId}`} className="py-4">
                    <p className="text-[15px] font-medium text-foreground">
                      {item.exerciseName}
                    </p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {item.detail}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
