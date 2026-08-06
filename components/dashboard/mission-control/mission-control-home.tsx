"use client"

import { AttentionRequiredSection } from "@/components/dashboard/mission-control/attention-required-section"
import { DailyBriefHeader } from "@/components/dashboard/mission-control/daily-brief-header"
import { HealthScoreStrip } from "@/components/dashboard/mission-control/health-score-strip"
import { MetricsGrid } from "@/components/dashboard/mission-control/metrics-grid"
import { WhatsChangedSection } from "@/components/dashboard/mission-control/whats-changed-section"
import {
  selectAttentionItems,
  selectPresentMetrics,
  selectWhatsChanged,
} from "@/lib/mission-control/presentation"
import type { MissionControlViewModel } from "@/lib/mission-control/view-model"

/**
 * Above-the-fold home stack — identical data on mobile and desktop.
 * Answers: how am I / what needs attention / what changed.
 */
export function MissionControlHome({ vm }: { vm: MissionControlViewModel }) {
  const attention = selectAttentionItems(vm)
  const metrics = selectPresentMetrics(vm)
  const changed = selectWhatsChanged(vm)

  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <DailyBriefHeader dailyBrief={vm.dailyBrief} vm={vm} />
      <HealthScoreStrip vm={vm} />
      <AttentionRequiredSection items={attention} />
      <MetricsGrid metrics={metrics} />
      <WhatsChangedSection items={changed} />
    </div>
  )
}
