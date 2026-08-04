"use client"

import { SectionLabel } from "@/components/ui/section-label"
import type { TrainingView } from "@/lib/health/training"
import { cn } from "@/lib/utils"

export function TrainingIntelligenceSections({
  view,
}: {
  view: TrainingView
}) {
  const quality = view.workoutQuality
  const cardio = view.cardioIntelligence
  const readiness = view.recoveryReadiness
  const programme = view.programmeAdherence

  return (
    <>
      <section id="workout-quality" className="space-y-6">
        <div>
          <SectionLabel>Workout Quality</SectionLabel>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Volume, intensity, variety, compounds, effort, and load — scored per
            strength session.
          </p>
        </div>
        <div className="mc-surface-hero px-6 py-8 sm:px-8">
          <div className="flex flex-wrap items-end gap-8">
            <div>
              <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                Average quality
              </p>
              <p className="mt-2 text-[48px] font-semibold tracking-tight text-foreground">
                {quality.average ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                30-day trend
              </p>
              <p className="mt-2 text-[15px] text-foreground">
                {quality.trendLabel ??
                  (quality.change30d != null
                    ? `${quality.change30d > 0 ? "+" : ""}${quality.change30d}`
                    : "—")}
              </p>
            </div>
          </div>
          <ul className="mt-8 divide-y divide-border/25">
            {quality.sessions.length === 0 ? (
              <li className="py-4 text-[15px] text-muted-foreground">
                Import Hevy strength sessions to score workout quality.
              </li>
            ) : (
              quality.sessions.slice(0, 6).map((session) => (
                <li
                  key={session.workoutId}
                  className="flex flex-wrap items-baseline justify-between gap-3 py-4"
                >
                  <div>
                    <p className="text-[15px] font-medium text-foreground">
                      {session.name}
                    </p>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      Vol {session.volumeScore ?? "—"} · Int{" "}
                      {session.intensityScore ?? "—"} · Variety{" "}
                      {session.varietyScore ?? "—"} · Compounds{" "}
                      {session.compoundRatio != null
                        ? `${session.compoundRatio}%`
                        : "—"}
                    </p>
                  </div>
                  <p className="text-[22px] font-semibold text-foreground">
                    {session.overall ?? "—"}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section id="cardio-intelligence" className="space-y-6">
        <div>
          <SectionLabel>Cardio Intelligence</SectionLabel>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Zone mix and activity breakdown versus the prior period.
          </p>
        </div>
        <div className="mc-surface-hero px-6 py-8 sm:px-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                Zone 2 minutes
              </p>
              <p className="mt-2 text-[36px] font-semibold tracking-tight text-foreground">
                {cardio.zone2Minutes}
              </p>
            </div>
            <div>
              <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                High intensity minutes
              </p>
              <p className="mt-2 text-[36px] font-semibold tracking-tight text-foreground">
                {cardio.highIntensityMinutes}
              </p>
            </div>
          </div>
          <p className="mt-4 text-[13px] text-muted-foreground">
            {cardio.periodLabel} vs {cardio.previousPeriodLabel}
          </p>
          <ul className="mt-6 divide-y divide-border/25">
            {cardio.buckets.map((bucket) => (
              <li
                key={bucket.id}
                className="flex flex-wrap items-baseline justify-between gap-3 py-3 text-[14px]"
              >
                <span className="text-foreground">{bucket.label}</span>
                <span className="text-muted-foreground">
                  {bucket.currentMinutes} min
                  {bucket.deltaMinutes !== 0 ? (
                    <span
                      className={cn(
                        "ml-2",
                        bucket.deltaMinutes > 0 ? "text-success" : "text-warning"
                      )}
                    >
                      {bucket.deltaMinutes > 0 ? "+" : ""}
                      {bucket.deltaMinutes}
                      {bucket.deltaPct != null
                        ? ` (${bucket.deltaPct > 0 ? "+" : ""}${bucket.deltaPct.toFixed(0)}%)`
                        : ""}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="recovery-readiness" className="space-y-6">
        <div>
          <SectionLabel>Training Readiness</SectionLabel>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Recovery, sleep, muscle freshness, cardio fatigue, and weekly load —
            scored separately. Guidance only.
          </p>
        </div>
        <div className="mc-surface-hero px-6 py-8 sm:px-8">
          <p className="text-[40px] font-semibold tracking-tight text-foreground">
            {readiness.label}
          </p>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            {readiness.detail}
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {readiness.scores.map((item) => (
              <div key={item.id} className="border-t border-border/25 pt-4">
                <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                  {item.label}
                </p>
                <p className="mt-2 text-[28px] font-semibold tracking-tight text-foreground">
                  {item.score ?? "—"}
                </p>
                {item.detail ? (
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {item.detail}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="programme-adherence" className="space-y-6">
        <div>
          <SectionLabel>Programme Adherence</SectionLabel>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Inferred from recent session titles — planned versus completed.
          </p>
        </div>
        <div className="mc-surface-hero px-6 py-8 sm:px-8">
          {!programme.available ? (
            <p className="text-[15px] text-muted-foreground">{programme.detail}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-8">
                <div>
                  <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                    Adherence
                  </p>
                  <p className="mt-2 text-[48px] font-semibold tracking-tight text-foreground">
                    {programme.adherencePct != null
                      ? `${programme.adherencePct}%`
                      : "—"}
                  </p>
                </div>
                <p className="max-w-md text-[14px] text-muted-foreground">
                  Planned {programme.plannedPattern.join(" → ")}
                </p>
              </div>
              <ul className="mt-8 divide-y divide-border/25">
                {programme.days.map((day) => (
                  <li
                    key={day.id}
                    className="flex flex-wrap items-baseline justify-between gap-3 py-3 text-[14px]"
                  >
                    <span className="text-muted-foreground">
                      Planned {day.planned}
                    </span>
                    <span className="text-foreground">
                      {day.status === "completed"
                        ? `Completed ${day.completed}`
                        : day.status === "swapped"
                          ? `Completed ${day.completed} (swapped)`
                          : `Skipped ${day.planned}`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <section id="exercise-insights" className="space-y-6">
        <div>
          <SectionLabel>Exercise Insights</SectionLabel>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Plateaus, progress, and relationships generated from your lifts.
          </p>
        </div>
        <ul className="divide-y divide-border/25">
          {view.story.exerciseInsights.length === 0 ? (
            <li className="py-4 text-[15px] text-muted-foreground">
              Exercise insights unlock after repeated Hevy sessions on the same lifts.
            </li>
          ) : (
            view.story.exerciseInsights.map((insight) => (
              <li key={insight.id} className="py-5">
                <p className="text-[15px] leading-relaxed text-foreground">
                  {insight.body}
                </p>
                <p className="mt-2 text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                  {insight.confidence} confidence
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </>
  )
}
