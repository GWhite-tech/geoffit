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
import {
  useMissionControl,
  type McTimeRange,
} from "@/lib/health/analytics"

export function MissionControl() {
  const [bodyRange, setBodyRange] = useState<McTimeRange>("90d")
  const view = useMissionControl(bodyRange)

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1280px] flex-col gap-20 px-6 py-12 lg:gap-24 lg:px-10 lg:py-14">
      <MorningBrief {...view.morningBrief} />

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
