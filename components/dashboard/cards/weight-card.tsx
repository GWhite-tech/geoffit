"use client"

import { Scale } from "lucide-react"

import { FadeUp } from "@/components/dashboard/motion/stagger"
import { DashboardCard } from "@/components/dashboard/ui/dashboard-card"
import { MetricTrend } from "@/components/dashboard/ui/metric-trend"
import { metrics } from "@/lib/dashboard-data"

export function WeightCard() {
  const { weight } = metrics

  return (
    <FadeUp className="lg:col-span-2">
      <DashboardCard accent="violet">
        <div className="flex items-start justify-between">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#7C3AED]/10 ring-1 ring-[#7C3AED]/20">
            <Scale className="size-4 text-[#8B5CF6]" />
          </div>
          <MetricTrend value={weight.trend} positive />
        </div>
        <p className="mt-6 text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Weight
        </p>
        <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">
          {weight.value}
          <span className="ml-1.5 text-lg font-normal text-muted-foreground">
            {weight.unit}
          </span>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          7-day avg · {weight.avg}
        </p>
      </DashboardCard>
    </FadeUp>
  )
}
