"use client"

import { useMemo, useState } from "react"

import { DesktopMissionControlLayout } from "@/components/dashboard/mission-control/desktop-mission-control-layout"
import { MobileMissionControlLayout } from "@/components/dashboard/mission-control/mobile-mission-control-layout"
import { useProfile } from "@/hooks/auth"
import {
  useMissionControl,
  type McTimeRange,
} from "@/lib/health/analytics"
import { useNutritionSummary } from "@/lib/health/nutrition"
import { useProgress } from "@/lib/health/progress"
import { buildMissionControlViewModel } from "@/lib/mission-control/view-model"

/**
 * Single Mission Control entry — same hooks and view-model on every viewport.
 * Desktop / mobile only swap layout density and arrangement.
 */
export function MissionControl() {
  const [bodyRange, setBodyRange] = useState<McTimeRange>("90d")
  const mc = useMissionControl(bodyRange)
  const { profile } = useProfile()
  const progress = useProgress("30d")
  const nutritionSummary = useNutritionSummary("7d")

  const vm = useMemo(
    () =>
      buildMissionControlViewModel({
        mc,
        profile,
        healthScore: progress.healthScore,
        nutritionSummary,
        bodyRange,
      }),
    [mc, profile, progress.healthScore, nutritionSummary, bodyRange]
  )

  return (
    <>
      <div className="md:hidden">
        <MobileMissionControlLayout
          vm={vm}
          onBodyRangeChange={setBodyRange}
        />
      </div>
      <div className="hidden md:block">
        <DesktopMissionControlLayout
          vm={vm}
          onBodyRangeChange={setBodyRange}
        />
      </div>
    </>
  )
}
