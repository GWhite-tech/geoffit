"use client"

import { TrainingPlanningSections } from "@/components/training/training-planning-sections"
import { SectionLabel } from "@/components/ui/section-label"
import type { TrainingGoals, TrainingView } from "@/lib/health/training"

export function TrainingStorySection({
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
  const story = view.story

  return (
    <section id="training-story" className="space-y-10">
      <div>
        <SectionLabel>Training Story</SectionLabel>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          A narrative generated from your training data — not a diary.
        </p>
      </div>

      {story.paragraphs.length === 0 ? (
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          Keep importing sessions and steps to unlock an automatic training story.
        </p>
      ) : (
        <ul className="space-y-5">
          {story.paragraphs.map((paragraph) => (
            <li key={paragraph.id}>
              <p className="text-[18px] leading-relaxed text-foreground sm:text-[20px]">
                {paragraph.body}
              </p>
              <p className="mt-2 text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                {paragraph.confidence} confidence
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <SectionLabel>What&apos;s Improved?</SectionLabel>
          <ul className="mt-4 divide-y divide-border/25">
            {story.improvements.length === 0 ? (
              <li className="py-4 text-[15px] text-muted-foreground">
                Improvements appear once trends clear the evidence threshold.
              </li>
            ) : (
              story.improvements.map((item) => (
                <li
                  key={item.id}
                  className="flex items-baseline justify-between gap-4 py-4"
                >
                  <div>
                    <p className="text-[15px] font-medium text-foreground">
                      {item.label}
                    </p>
                    {item.detail ? (
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        {item.detail}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-[22px] font-semibold tracking-tight text-success">
                    {item.value}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div>
          <SectionLabel>What&apos;s Limiting Progress?</SectionLabel>
          <ul className="mt-4 divide-y divide-border/25">
            {story.limitations.length === 0 ? (
              <li className="py-4 text-[15px] text-muted-foreground">
                No clear limiters in the current evidence window.
              </li>
            ) : (
              story.limitations.map((item) => (
                <li key={item.id} className="py-4">
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
        </div>
      </div>

      <div>
        <SectionLabel>Recommendations</SectionLabel>
        <ul className="mt-4 divide-y divide-border/25">
          {story.recommendations.length === 0 ? (
            <li className="py-4 text-[15px] text-muted-foreground">
              Recommendations appear once enough training and recovery signal is present.
            </li>
          ) : (
            story.recommendations.map((item) => (
              <li key={item.id} className="py-5">
                <p className="text-[16px] leading-relaxed text-foreground">
                  {item.body}
                </p>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  {item.evidence}
                </p>
                <p className="mt-2 text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                  {item.confidence} confidence
                </p>
              </li>
            ))
          )}
        </ul>
      </div>

      <TrainingPlanningSections
        view={view}
        goals={goals}
        onGoalsChange={onGoalsChange}
        onActivateProgramme={onActivateProgramme}
        onDeactivateProgramme={onDeactivateProgramme}
      />
    </section>
  )
}
