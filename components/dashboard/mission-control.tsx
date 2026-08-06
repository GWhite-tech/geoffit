"use client"

import { useState } from "react"
import Link from "next/link"

import { BloodMarkersSection } from "@/components/dashboard/mission-control/blood-markers-section"
import { BodyCompositionSection } from "@/components/dashboard/mission-control/body-composition-section"
import { McTimelineSection } from "@/components/dashboard/mission-control/mc-timeline-section"
import { PerformanceSection } from "@/components/dashboard/mission-control/performance-section"
import { RecoverySection } from "@/components/dashboard/mission-control/recovery-section"
import { NutritionSection } from "@/components/dashboard/mission-control/nutrition-section"
import { TreatmentAlertsSection } from "@/components/dashboard/mission-control/treatment-alerts-section"
import { WeeklyReviewBrief } from "@/components/dashboard/weekly-review-brief"
import { EmptyState } from "@/components/ui/empty-state"
import { MorningBrief } from "@/components/ui/morning-brief"
import { useProfile } from "@/hooks/auth"
import {
  useMissionControl,
  type McTimeRange,
} from "@/lib/health/analytics"
import { buildWelcomeBrief } from "@/lib/platform/welcome-brief"

export function MissionControl() {
  const [bodyRange, setBodyRange] = useState<McTimeRange>("90d")
  const view = useMissionControl(bodyRange)
  const { greetingName } = useProfile()

  const weightSeries = view.bodyComposition.series.find((s) => s.id === "weight")
  const weightPoints = weightSeries?.points ?? []
  const first = weightPoints[0]?.value
  const last = weightPoints[weightPoints.length - 1]?.value
  const weightDeltaLabel =
    typeof first === "number" &&
    typeof last === "number" &&
    weightPoints.length > 1
      ? last < first
        ? `You've lost ${(first - last).toFixed(1)}kg over this range.`
        : last > first
          ? `Weight is up ${(last - first).toFixed(1)}kg over this range.`
          : null
      : null

  const sleepCard = view.recovery.find((card) => /sleep/i.test(card.label))
  const sleepDeltaLabel = sleepCard?.trendDisplay
    ? `Sleep ${sleepCard.trendDisplay}.`
    : null

  const trainingCard = view.performance[0]
  const priorityLabel = trainingCard?.label ?? null

  const welcome = buildWelcomeBrief({
    name: greetingName,
    bodyFromAnalytics: view.morningBrief.body,
    hasData: view.hasData,
    weightDeltaLabel,
    sleepDeltaLabel,
    priorityLabel,
    medicationLabel: null,
  })

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1280px] flex-col gap-20 px-6 py-12 pb-24 lg:gap-24 lg:px-10 lg:py-14 md:pb-14">
      <MorningBrief
        greeting={welcome.greeting}
        name={welcome.name}
        lines={welcome.lines}
      />

      <WeeklyReviewBrief />

      {!view.hasData ? (
        <EmptyState
          title="No health data yet"
          description="Import Apple Health and blood tests to answer one question: is your health improving?"
          action={
            <Link
              href="/import"
              className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Open Data Sources
            </Link>
          }
        />
      ) : null}

      <BodyCompositionSection
        bodyComposition={view.bodyComposition}
        range={bodyRange}
        onRangeChange={setBodyRange}
      />

      <BloodMarkersSection markers={view.bloodMarkers} />

      <TreatmentAlertsSection />

      <NutritionSection />

      <RecoverySection cards={view.recovery} />

      <PerformanceSection cards={view.performance} />

      <McTimelineSection events={view.timeline} />
    </div>
  )
}
