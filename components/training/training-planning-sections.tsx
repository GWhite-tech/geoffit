"use client"

import { MetricHero } from "@/components/training/training-charts"
import { ProgrammeSection } from "@/components/training/programme-section"
import { SectionLabel } from "@/components/ui/section-label"
import type { TrainingGoals, TrainingView } from "@/lib/health/training"

export function TrainingPlanningSections({
  view,
  goals,
  onGoalsChange,
  onActivateProgramme,
  onDeactivateProgramme,
}: {
  view: TrainingView
  goals: TrainingGoals
  onGoalsChange: (patch: Partial<TrainingGoals>) => void
  onActivateProgramme: (programmeId: string) => void
  onDeactivateProgramme: () => void
}) {
  const planning = view.planning
  const next = planning.nextBestSession

  return (
    <>
      <section id="next-best-session" className="space-y-6">
        <MetricHero
          label="Next Best Session"
          value={next.title}
          detail={next.why.join(" ")}
          trend={`${next.confidence} confidence${
            next.fromProgramme ? " · From programme" : ""
          }${next.avoid ? ` · ${next.avoid}` : ""}`}
        />
        <ul className="space-y-3">
          {next.why.map((line) => (
            <li
              key={line}
              className="border-t border-border/25 pt-3 text-[15px] leading-relaxed text-foreground"
            >
              {line}
            </li>
          ))}
        </ul>
      </section>

      <ProgrammeSection
        view={view}
        onActivate={onActivateProgramme}
        onDeactivate={onDeactivateProgramme}
      />

      <section id="volume-planner" className="space-y-6">
        <div>
          <SectionLabel>Volume Planner</SectionLabel>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Target, completed, and remaining sets for {planning.volumePlanner.weekLabel.toLowerCase()}.
          </p>
        </div>
        <ul className="divide-y divide-border/25">
          {planning.volumePlanner.rows.map((row) => (
            <li
              key={row.id}
              className="grid grid-cols-[1fr_repeat(3,minmax(0,72px))] items-baseline gap-3 py-4 text-[14px] sm:grid-cols-[1.4fr_repeat(3,minmax(0,88px))]"
            >
              <span className="font-medium text-foreground">{row.label}</span>
              <span className="text-muted-foreground">
                <span className="block text-[11px] tracking-[0.12em] uppercase">
                  Target
                </span>
                {row.target}
              </span>
              <span className="text-muted-foreground">
                <span className="block text-[11px] tracking-[0.12em] uppercase">
                  Done
                </span>
                {row.completed}
              </span>
              <span className="text-foreground">
                <span className="block text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                  {row.complete ? "Status" : "Left"}
                </span>
                {row.complete ? "Complete" : row.remaining}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section id="exercise-rotation" className="space-y-6">
        <div>
          <SectionLabel>Exercise Rotation</SectionLabel>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Movements that have gone cold — candidates to reintroduce.
          </p>
        </div>
        <ul className="divide-y divide-border/25">
          {planning.exerciseRotation.length === 0 ? (
            <li className="py-4 text-[15px] text-muted-foreground">
              No stale lifts above the rotation threshold yet.
            </li>
          ) : (
            planning.exerciseRotation.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-baseline justify-between gap-3 py-4"
              >
                <div>
                  <p className="text-[15px] font-medium text-foreground">
                    Last {item.name}
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {item.recommendation}
                  </p>
                </div>
                <p className="text-[14px] text-muted-foreground">
                  {item.daysSince} days ago
                </p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section id="training-balance" className="space-y-6">
        <div>
          <SectionLabel>Training Balance</SectionLabel>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Push vs pull, upper vs lower, strength vs cardio, compounds vs isolation.
          </p>
        </div>
        <ul className="divide-y divide-border/25">
          {planning.trainingBalance.length === 0 ? (
            <li className="py-4 text-[15px] text-muted-foreground">
              Balance insights appear once both sides of your training have enough volume.
            </li>
          ) : (
            planning.trainingBalance.map((item) => (
              <li key={item.id} className="py-5">
                <p className="text-[15px] leading-relaxed text-foreground">
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

      <section id="personal-best-opportunities" className="space-y-6">
        <div>
          <SectionLabel>Personal Best Opportunities</SectionLabel>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Likely PR windows — never certainty.
          </p>
        </div>
        <ul className="divide-y divide-border/25">
          {planning.personalBestOpportunities.length === 0 ? (
            <li className="py-4 text-[15px] text-muted-foreground">
              PR opportunities appear when recovery and recent attempts align.
            </li>
          ) : (
            planning.personalBestOpportunities.map((item) => (
              <li key={item.id} className="py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="text-[16px] font-medium text-foreground">
                    {item.exerciseName}
                  </p>
                  <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                    Chance {item.chance}
                  </p>
                </div>
                <p className="mt-2 text-[14px] text-muted-foreground">{item.why}</p>
                <div className="mt-3 flex flex-wrap gap-6 text-[14px]">
                  <span className="text-muted-foreground">
                    Last attempt{" "}
                    <strong className="text-foreground">
                      {item.lastAttempt ?? "—"}
                    </strong>
                  </span>
                  <span className="text-muted-foreground">
                    Recommended{" "}
                    <strong className="text-foreground">
                      {item.recommendedTarget ?? "—"}
                    </strong>
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section id="weekly-plan" className="space-y-6">
        <div>
          <SectionLabel>Weekly Plan</SectionLabel>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Suggested week from recovery, programme, and goals — guidance only.
          </p>
        </div>
        <ul className="divide-y divide-border/25">
          {planning.weeklyPlan.days.map((day) => (
            <li
              key={day.id}
              className="flex flex-wrap items-baseline justify-between gap-3 py-4"
            >
              <div>
                <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                  {day.dayLabel}
                </p>
                <p className="mt-1 text-[16px] font-medium text-foreground">
                  {day.session}
                </p>
                {day.detail ? (
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {day.detail}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <p className="text-[13px] text-muted-foreground">
          {planning.weeklyPlan.disclaimer}
        </p>
      </section>

      <section id="training-goals" className="space-y-6">
        <div>
          <SectionLabel>Training Goals</SectionLabel>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Configurable weekly targets and progress so far this week.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <GoalField
            label="Strength sessions / week"
            value={goals.strengthSessionsPerWeek}
            onChange={(value) =>
              onGoalsChange({ strengthSessionsPerWeek: value })
            }
          />
          <GoalField
            label="Cardio minutes / week"
            value={goals.cardioMinutesPerWeek}
            onChange={(value) => onGoalsChange({ cardioMinutesPerWeek: value })}
          />
          <GoalField
            label="Daily steps"
            value={goals.dailySteps}
            onChange={(value) => onGoalsChange({ dailySteps: value })}
          />
          <GoalField
            label="Weekly volume (kg)"
            value={goals.weeklyVolumeKg ?? 0}
            onChange={(value) =>
              onGoalsChange({ weeklyVolumeKg: value > 0 ? value : null })
            }
          />
          <GoalField
            label="Walking distance (km)"
            value={goals.walkingDistanceKm ?? 0}
            onChange={(value) =>
              onGoalsChange({ walkingDistanceKm: value > 0 ? value : null })
            }
          />
        </div>

        <ul className="mt-4 divide-y divide-border/25">
          {planning.goalProgress.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-baseline justify-between gap-3 py-4"
            >
              <div>
                <p className="text-[15px] font-medium text-foreground">
                  {item.label}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {item.current ?? "—"} / {item.target} {item.unit}
                </p>
              </div>
              <p className="text-[22px] font-semibold tracking-tight text-foreground">
                {item.pct != null ? `${item.pct}%` : "—"}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function GoalField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block border-t border-border/25 pt-4">
      <span className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
        {label}
      </span>
      <input
        type="number"
        min={0}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="mt-2 h-10 w-full rounded-xl border border-border/40 bg-card/30 px-3 text-[15px] text-foreground"
      />
    </label>
  )
}
