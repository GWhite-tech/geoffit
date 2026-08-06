"use client"

import { BloodMarkersSection } from "@/components/dashboard/mission-control/blood-markers-section"
import { BodyCompositionSection } from "@/components/dashboard/mission-control/body-composition-section"
import { McTimelineSection } from "@/components/dashboard/mission-control/mc-timeline-section"
import { MissionControlHome } from "@/components/dashboard/mission-control/mission-control-home"
import { MobileCollapsibleSection } from "@/components/dashboard/mission-control/mobile-collapsible-section"
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

export function MobileMissionControlLayout({
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
    <div className="mx-auto flex w-full max-w-[390px] flex-col gap-8 px-5 pt-5 pb-12">
      <MissionControlHome vm={vm} />

      {vm.hasData ? (
        <div className="space-y-2.5">
          <p className="px-1 pt-2 text-[12px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Detailed Health
          </p>

          {showBody ? (
            <MobileCollapsibleSection title="Body">
              <BodyCompositionSection
                bodyComposition={vm.bodyComposition}
                range={vm.bodyRange}
                onRangeChange={onBodyRangeChange}
              />
            </MobileCollapsibleSection>
          ) : null}

          {vm.bloodHighlights.length > 0 ? (
            <MobileCollapsibleSection title="Blood">
              <BloodMarkersSection markers={vm.bloodHighlights} />
            </MobileCollapsibleSection>
          ) : null}

          {recovery.length > 0 ? (
            <MobileCollapsibleSection title="Recovery">
              <RecoverySection cards={recovery} />
            </MobileCollapsibleSection>
          ) : null}

          {vm.nutrition?.available ? (
            <MobileCollapsibleSection title="Nutrition">
              <NutritionSection />
            </MobileCollapsibleSection>
          ) : null}

          {training.length > 0 ? (
            <MobileCollapsibleSection title="Training">
              <PerformanceSection cards={training} />
            </MobileCollapsibleSection>
          ) : null}

          <TreatmentAlertsSection />

          {vm.timeline.length > 0 ? (
            <MobileCollapsibleSection title="Timeline">
              <McTimelineSection events={vm.timeline} />
            </MobileCollapsibleSection>
          ) : null}

          <WeeklyReviewBrief />
        </div>
      ) : null}
    </div>
  )
}
