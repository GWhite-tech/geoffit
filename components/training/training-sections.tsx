"use client"

import {
  MetricHero,
  RangePills,
  TrainingLineChart,
} from "@/components/training/training-charts"
import { MuscleBalanceSection } from "@/components/training/muscle-balance-section"
import { TrainingIntelligenceSections } from "@/components/training/training-intelligence-sections"
import { TrainingStorySection } from "@/components/training/training-story-section"
import { SectionLabel } from "@/components/ui/section-label"
import type {
  StrengthMetricId,
  TrainingGoals,
  TrainingRange,
  TrainingView,
} from "@/lib/health/training"

const STRENGTH_METRICS: { id: StrengthMetricId; label: string }[] = [
  { id: "weekly_volume", label: "Weekly Volume" },
  { id: "estimated_1rm", label: "Estimated 1RM" },
  { id: "workout_count", label: "Workout Count" },
  { id: "sets", label: "Sets" },
  { id: "reps", label: "Reps" },
  { id: "training_time", label: "Training Time" },
  { id: "volume_by_muscle", label: "Volume by Muscle" },
]

const STEP_RANGES: { id: TrainingRange; label: string }[] = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "6m", label: "6M" },
  { id: "1y", label: "1Y" },
  { id: "all", label: "All" },
]

export function TrainingSections({
  view,
  strengthMetric,
  onStrengthMetric,
  selectedExercise,
  onSelectExercise,
  stepRange,
  onStepRange,
  goals,
  onGoalsChange,
  onActivateProgramme,
  onDeactivateProgramme,
}: {
  view: TrainingView
  strengthMetric: StrengthMetricId
  onStrengthMetric: (id: StrengthMetricId) => void
  selectedExercise: string | null
  onSelectExercise: (name: string) => void
  stepRange: TrainingRange
  onStepRange: (range: TrainingRange) => void
  goals: TrainingGoals
  onGoalsChange: (patch: Partial<TrainingGoals>) => void
  onActivateProgramme: (programmeId: string) => void
  onDeactivateProgramme: () => void
}) {
  const score = view.score
  const exercise = view.selectedExercise

  return (
    <>
      <section id="training-score" className="space-y-6">
        <MetricHero
          label="Training Score"
          value={score.score != null ? String(score.score) : "—"}
          detail="Consistency, strength progression, cardio, volume, recovery, steps, and adherence."
          trend={
            score.change30d != null
              ? `${score.change30d > 0 ? "+" : score.change30d < 0 ? "−" : ""}${Math.abs(score.change30d)} over 30 days · ${score.confidenceLabel} confidence`
              : `${score.confidenceLabel} confidence`
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {score.components.map((component) => (
            <div key={component.id} className="border-t border-border/25 pt-4">
              <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                {component.label}
              </p>
              <p className="mt-2 text-[28px] font-semibold tracking-tight text-foreground">
                {component.score ?? "—"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <TrainingStorySection
        view={view}
        goals={goals}
        onGoalsChange={onGoalsChange}
        onActivateProgramme={onActivateProgramme}
        onDeactivateProgramme={onDeactivateProgramme}
      />

      <section id="strength" className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <SectionLabel>Strength Analytics</SectionLabel>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Hevy-backed structure with rolling averages — the hero of Training.
            </p>
          </div>
          <RangePills
            items={STRENGTH_METRICS}
            value={strengthMetric}
            onChange={onStrengthMetric}
          />
        </div>
        <div className="mc-surface-hero px-5 py-7 sm:px-8 sm:py-10">
          <div className="mb-6 flex flex-wrap gap-6 text-[13px] text-muted-foreground">
            <span>
              Volume{" "}
              <strong className="text-foreground">
                {view.strength.totalVolumeKg?.toLocaleString("en-GB") ?? "—"} kg
              </strong>
            </span>
            <span>
              Sessions{" "}
              <strong className="text-foreground">
                {view.strength.sessionCount}
              </strong>
            </span>
            <span>
              Best 1RM{" "}
              <strong className="text-foreground">
                {view.strength.bestEstimated1RmKg != null
                  ? `${view.strength.bestEstimated1RmKg} kg`
                  : "—"}
              </strong>
            </span>
          </div>
          {strengthMetric === "volume_by_muscle" ? (
            <ul className="space-y-3">
              {view.strength.series.map((point) => (
                <li
                  key={point.date}
                  className="flex items-center justify-between border-t border-border/25 py-3"
                >
                  <span className="text-[14px] text-foreground">{point.label}</span>
                  <span className="text-[14px] text-muted-foreground">
                    {Math.round(point.value).toLocaleString("en-GB")} kg
                  </span>
                </li>
              ))}
              {view.strength.series.length === 0 ? (
                <p className="text-[15px] text-muted-foreground">
                  Import Hevy workouts to see muscle volume.
                </p>
              ) : null}
            </ul>
          ) : (
            <TrainingLineChart
              series={view.strength.series}
              rolling={view.strength.rollingAverage}
            />
          )}
        </div>
      </section>

      <section id="exercise" className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <SectionLabel>Exercise Progression</SectionLabel>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Working weight, estimated 1RM, volume, and plateaus for any lift.
            </p>
          </div>
          {view.exerciseNames.length > 0 ? (
            <select
              value={selectedExercise ?? exercise.name}
              onChange={(event) => onSelectExercise(event.target.value)}
              className="h-9 rounded-xl border border-border/40 bg-card/30 px-3 text-[13px] text-foreground"
            >
              {view.exerciseNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <div className="mc-surface-hero px-5 py-7 sm:px-8 sm:py-10">
          {!exercise.available ? (
            <p className="text-[15px] text-muted-foreground">{exercise.emptyHint}</p>
          ) : (
            <>
              <div className="mb-8 flex flex-wrap gap-6">
                <div>
                  <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                    Best weight
                  </p>
                  <p className="mt-1 text-[24px] font-semibold text-foreground">
                    {exercise.personalRecords.maxWeightKg != null
                      ? `${exercise.personalRecords.maxWeightKg} kg`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                    Est. 1RM
                  </p>
                  <p className="mt-1 text-[24px] font-semibold text-foreground">
                    {exercise.personalRecords.maxEstimated1RmKg != null
                      ? `${exercise.personalRecords.maxEstimated1RmKg} kg`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                    Trend
                  </p>
                  <p className="mt-1 text-[15px] text-foreground">
                    {exercise.plateau
                      ? "Plateau"
                      : exercise.trendLabel ?? "—"}
                  </p>
                </div>
              </div>
              <TrainingLineChart series={exercise.estimated1RmSeries} />
            </>
          )}
        </div>
      </section>

      <MuscleBalanceSection view={view} />

      <TrainingIntelligenceSections view={view} />

      <section id="cardio" className="space-y-6">
        <div>
          <SectionLabel>Cardio</SectionLabel>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Apple Health cardio minutes, distance, and activity mix over time.
          </p>
        </div>
        <div className="mc-surface-hero px-5 py-7 sm:px-8 sm:py-10">
          <div className="mb-6 flex flex-wrap gap-6 text-[13px] text-muted-foreground">
            <span>
              Minutes{" "}
              <strong className="text-foreground">{view.cardio.totalMinutes}</strong>
            </span>
            <span>
              Sessions{" "}
              <strong className="text-foreground">{view.cardio.sessionCount}</strong>
            </span>
          </div>
          <TrainingLineChart series={view.cardio.minutesSeries} />
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {view.cardio.byActivity.map((activity) => (
              <li
                key={activity.id}
                className="flex items-center justify-between border-t border-border/25 py-3 text-[14px]"
              >
                <span className="text-foreground">{activity.label}</span>
                <span className="text-muted-foreground">
                  {activity.minutes} min · {activity.sessions}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="steps" className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <SectionLabel>Daily Steps</SectionLabel>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Apple Health only — daily steps with goal line and averages.
            </p>
          </div>
          <RangePills
            items={STEP_RANGES}
            value={stepRange}
            onChange={onStepRange}
          />
        </div>
        <div className="mc-surface-hero px-5 py-7 sm:px-8 sm:py-10">
          <div className="mb-6 flex flex-wrap gap-6 text-[13px] text-muted-foreground">
            <span>
              7D avg{" "}
              <strong className="text-foreground">
                {view.steps.average7d?.toLocaleString("en-GB") ?? "—"}
              </strong>
            </span>
            <span>
              30D avg{" "}
              <strong className="text-foreground">
                {view.steps.average30d?.toLocaleString("en-GB") ?? "—"}
              </strong>
            </span>
            <span>
              Streak{" "}
              <strong className="text-foreground">
                {view.steps.longestStreak} days
              </strong>
            </span>
            <span>
              Peak{" "}
              <strong className="text-foreground">
                {view.steps.highestDay
                  ? view.steps.highestDay.value.toLocaleString("en-GB")
                  : "—"}
              </strong>
            </span>
          </div>
          <TrainingLineChart
            series={view.steps.daily}
            goal={view.steps.goal}
          />
          <div className="mt-6 flex flex-wrap gap-6 text-[13px] text-muted-foreground">
            <span>
              Weekday avg{" "}
              <strong className="text-foreground">
                {view.steps.weekdayAverage?.toLocaleString("en-GB") ?? "—"}
              </strong>
            </span>
            <span>
              Weekend avg{" "}
              <strong className="text-foreground">
                {view.steps.weekendAverage?.toLocaleString("en-GB") ?? "—"}
              </strong>
            </span>
          </div>
        </div>
      </section>

      <section id="load" className="space-y-6">
        <div>
          <SectionLabel>Training Load</SectionLabel>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Classifies recent volume and frequency — never a diagnosis.
          </p>
        </div>
        <div className="mc-surface-hero px-6 py-8 sm:px-8">
          <p className="text-[40px] font-semibold tracking-tight text-foreground">
            {view.load.label}
          </p>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            {view.load.detail}
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <LoadStat
              label="Weekly volume"
              value={
                view.load.weeklyVolumeKg != null
                  ? `${view.load.weeklyVolumeKg.toLocaleString("en-GB")} kg`
                  : "—"
              }
            />
            <LoadStat
              label="Sessions"
              value={String(view.load.weeklySessions)}
            />
            <LoadStat
              label="Cardio"
              value={`${view.load.weeklyCardioMinutes} min`}
            />
            <LoadStat
              label="Recovery balance"
              value={
                view.load.recoveryBalance != null
                  ? `${view.load.recoveryBalance}%`
                  : "—"
              }
            />
          </div>
        </div>
      </section>

      <section id="recovery-performance" className="space-y-6">
        <div>
          <SectionLabel>Recovery vs Performance</SectionLabel>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Relationships between sleep, recovery, and training density.
          </p>
        </div>
        <ul className="divide-y divide-border/25">
          {view.recoveryPerformance.length === 0 ? (
            <li className="py-4 text-[15px] text-muted-foreground">
              Import sleep and recovery signals to surface relationships.
            </li>
          ) : (
            view.recoveryPerformance.map((item) => (
              <li key={item.id} className="py-5">
                <p className="text-[15px] leading-relaxed text-foreground">
                  {item.body}
                </p>
                <p className="mt-2 text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                  {item.confidence} confidence
                </p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section id="prs" className="space-y-6">
        <div>
          <SectionLabel>Personal Records</SectionLabel>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Automatically detected from Hevy structure and Apple Health activity.
          </p>
        </div>
        <ul className="divide-y divide-border/25">
          {view.personalRecords.length === 0 ? (
            <li className="py-4 text-[15px] text-muted-foreground">
              PRs appear once workouts and steps are imported.
            </li>
          ) : (
            view.personalRecords.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-baseline justify-between gap-3 py-4"
              >
                <div>
                  <p className="text-[15px] font-medium text-foreground">
                    {item.title}
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
                <p className="text-[12px] text-muted-foreground">{item.date}</p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section id="timeline" className="space-y-6">
        <div>
          <SectionLabel>Training Timeline</SectionLabel>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Chronological sessions — one row per merged workout, never duplicated.
          </p>
        </div>
        <ul className="divide-y divide-border/25">
          {view.timeline.length === 0 ? (
            <li className="py-4 text-[15px] text-muted-foreground">
              Import Hevy or Apple Health workouts to build the timeline.
            </li>
          ) : (
            view.timeline.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-baseline justify-between gap-3 py-4"
              >
                <div>
                  <p className="text-[15px] font-medium text-foreground">
                    {event.title}
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {event.detail}
                    {event.sourcesLabel ? ` · ${event.sourcesLabel}` : ""}
                  </p>
                </div>
                <p className="text-[12px] text-muted-foreground">
                  {event.dateLabel}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section id="insights" className="space-y-6">
        <div>
          <SectionLabel>Insights</SectionLabel>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Generated from your data — never hardcoded copy.
          </p>
        </div>
        <ul className="divide-y divide-border/25">
          {view.insights.length === 0 ? (
            <li className="py-4 text-[15px] text-muted-foreground">
              Keep importing sessions to unlock automatic insights.
            </li>
          ) : (
            view.insights.map((insight) => (
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

      <section id="forecast" className="space-y-6">
        <div>
          <SectionLabel>Forecast</SectionLabel>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Directional projections with explicit confidence — never certainty.
          </p>
        </div>
        <ul className="divide-y divide-border/25">
          {view.forecast.length === 0 ? (
            <li className="py-4 text-[15px] text-muted-foreground">
              Forecasts need a longer training history.
            </li>
          ) : (
            view.forecast.map((item) => (
              <li key={item.id} className="py-5">
                <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                  {item.label}
                </p>
                <p className="mt-2 text-[15px] leading-relaxed text-foreground">
                  {item.projection}
                </p>
                <p className="mt-2 text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                  {item.confidence} confidence
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </>
  )
}

function LoadStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
        {label}
      </p>
      <p className="mt-2 text-[22px] font-semibold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  )
}
