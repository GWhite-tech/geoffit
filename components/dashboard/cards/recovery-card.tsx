"use client"

import { Zap } from "lucide-react"

import { FadeUp } from "@/components/dashboard/motion/stagger"
import { DashboardCard } from "@/components/dashboard/ui/dashboard-card"
import { RecoveryBar } from "@/components/dashboard/ui/recovery-bar"
import { Badge } from "@/components/ui/badge"
import { metrics } from "@/lib/dashboard-data"

export function RecoveryCard() {
  const { recovery } = metrics

  return (
    <FadeUp className="lg:col-span-4">
      <DashboardCard accent="violet">
        <div className="flex items-start justify-between">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#7C3AED]/10 ring-1 ring-[#7C3AED]/20">
            <Zap className="size-4 text-[#8B5CF6]" />
          </div>
          <Badge
            variant="secondary"
            className="bg-[#7C3AED]/10 text-[#8B5CF6] ring-1 ring-[#7C3AED]/20"
          >
            Good
          </Badge>
        </div>
        <p className="mt-6 text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Recovery
        </p>
        <div className="mt-2 flex items-baseline gap-3">
          <p className="text-4xl font-semibold tracking-tight tabular-nums">
            {recovery.value}
            <span className="text-lg font-normal text-muted-foreground">%</span>
          </p>
          <span className="text-xs text-status-positive">{recovery.trend}</span>
        </div>
        <RecoveryBar value={recovery.value} className="mt-4" />
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span>
            HRV <strong className="text-foreground">{recovery.hrv}</strong>
          </span>
          <span>
            Resting HR{" "}
            <strong className="text-foreground">{recovery.restingHr}</strong>
          </span>
          <span>
            Sleep <strong className="text-foreground">{recovery.sleep}</strong>
          </span>
        </div>
      </DashboardCard>
    </FadeUp>
  )
}
