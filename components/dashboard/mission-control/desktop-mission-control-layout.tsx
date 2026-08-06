"use client"

import { BloodMarkersSection } from "@/components/dashboard/mission-control/blood-markers-section"
import { BodyCompositionSection } from "@/components/dashboard/mission-control/body-composition-section"
import { McTimelineSection } from "@/components/dashboard/mission-control/mc-timeline-section"
import { MissionControlHome } from "@/components/dashboard/mission-control/mission-control-home"
import { NutritionSection } from "@/components/dashboard/mission-control/nutrition-section"
import { PerformanceSection } from "@/components/dashboard/mission-control/performance-section"
import { RecoverySection } from "@/components/dashboard/mission-control/recovery-section"
import { TreatmentAlertsSection } from "@/components/dashboard/mission-control/treatment-alerts-section"
import { WeeklyReviewBrief } from "@/components/dashboard/weekly-review-brief"
import type { McTimeRange } from "@/lib/health/analytics"
import {
  availableRecovery,
  availableTraining,
  hasBodyChart,
} from "@/lib/mission-control/presentation"
import type { MissionControlViewModel } from "@/lib/mission-control/view-model"

export function DesktopMissionControlLayout({
  vm,
  onBodyRangeChange,
}: {
  vm: MissionControlViewModel
  onBodyRangeChange: (range: McTimeRange) => void
}) {
  const recovery = availableRecovery(vm)
  const training = availableTraining(vm)
  const showBody = hasBodyChart(vm)

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1120px] flex-col gap-14 px-8 py-12 pb-24 lg:gap-16 lg:px-10 lg:py-14">
      <MissionControlHome vm={vm} />

      {vm.hasData ? (
        <div className="flex flex-col gap-14 lg:gap-16">
          <p className="text-[12px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Detailed Health
          </p>

          {showBody ? (
            <BodyCompositionSection
              bodyComposition={vm.bodyComposition}
              range={vm.bodyRange}
              onRangeChange={onBodyRangeChange}
            />
          ) : null}

          {vm.bloodHighlights.length > 0 ? (
            <BloodMarkersSection markers={vm.bloodHighlights} />
          ) : null}

          {recovery.length > 0 ? <RecoverySection cards={recovery} /> : null}

          {vm.nutrition?.available ? <NutritionSection /> : null}

          {training.length > 0 ? <PerformanceSection cards={training} /> : null}

          <TreatmentAlertsSection />

          {vm.timeline.length > 0 ? (
            <McTimelineSection events={vm.timeline} />
          ) : null}

          <WeeklyReviewBrief />
        </div>
      ) : null}
    </div>
  )
}
