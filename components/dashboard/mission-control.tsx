"use client"

import { ActivityTimeline } from "@/components/ui/activity-timeline"
import { GoalsModule } from "@/components/ui/goals-module"
import { MorningBrief } from "@/components/ui/morning-brief"
import { ProgressChart } from "@/components/ui/progress-chart"
import { SnapshotRow } from "@/components/ui/snapshot-row"
import { StatusPanel } from "@/components/ui/status-panel"
import { TodaysFocus } from "@/components/ui/todays-focus"
import {
  goalProgress,
  healthStatus,
  morningBrief,
  progressChart,
  snapshotMetrics,
  timelineEvents,
  todaysFocus,
} from "@/lib/mission-control-data"

export function MissionControl() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1200px] flex-col gap-12 px-6 py-10 lg:gap-14 lg:px-10 lg:py-12">
      {/* Top band */}
      <div className="space-y-12 lg:space-y-14">
        <MorningBrief {...morningBrief} />
        <SnapshotRow metrics={snapshotMetrics} />
      </div>

      {/* Workspace row */}
      <div className="grid flex-1 grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
        <TodaysFocus
          workout={todaysFocus.workout}
          protocol={todaysFocus.protocol.items}
        />

        <div className="flex flex-col gap-8">
          <ProgressChart
            metric={progressChart.metric}
            unit={progressChart.unit}
            goal={progressChart.goal}
            weeklyAverage={progressChart.weeklyAverage}
            points={progressChart.points}
            className="min-h-[420px]"
          />
          <GoalsModule {...goalProgress} />
        </div>
      </div>

      {/* Bottom band */}
      <div className="grid grid-cols-1 gap-8 pb-6 lg:grid-cols-2 lg:gap-10">
        <StatusPanel modules={healthStatus} />
        <ActivityTimeline events={timelineEvents} />
      </div>
    </div>
  )
}
