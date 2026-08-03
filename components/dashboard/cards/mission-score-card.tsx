"use client"

import { TrendingUp } from "lucide-react"

import { FadeUp } from "@/components/dashboard/motion/stagger"
import { DashboardCard } from "@/components/dashboard/ui/dashboard-card"
import { MissionRing } from "@/components/dashboard/ui/mission-ring"
import { Badge } from "@/components/ui/badge"
import { metrics, missionBreakdown } from "@/lib/dashboard-data"
import { cn } from "@/lib/utils"

export function MissionScoreCard() {
  return (
    <FadeUp className="lg:col-span-4 lg:row-span-2">
      <DashboardCard accent="violet" className="h-full">
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
                Mission Score
              </p>
              <p className="mt-1 text-sm text-muted-foreground/80">
                Your daily health composite
              </p>
            </div>
            <Badge
              variant="secondary"
              className="gap-1 bg-emerald-500/10 text-status-positive ring-1 ring-emerald-500/20"
            >
              <TrendingUp className="size-3" />
              +4 vs yesterday
            </Badge>
          </div>

          <div className="mt-8 flex flex-1 flex-col items-center justify-center gap-8 lg:flex-row lg:items-center lg:justify-between">
            <MissionRing score={metrics.missionScore} />
            <div className="grid w-full grid-cols-2 gap-3">
              {missionBreakdown.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl bg-foreground/[0.03] p-4 ring-1 ring-foreground/[0.04]"
                >
                  <p className="text-[11px] text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {item.value}
                  </p>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                    <div
                      className={cn(
                        "h-full rounded-full bg-gradient-to-r from-[#6D28D9] to-[#8B5CF6]"
                      )}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DashboardCard>
    </FadeUp>
  )
}
