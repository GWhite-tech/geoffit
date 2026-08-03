"use client"

import { FadeUp } from "@/components/dashboard/motion/stagger"
import { DashboardCard } from "@/components/dashboard/ui/dashboard-card"
import { quickActions } from "@/lib/dashboard-data"
import { cn } from "@/lib/utils"

export function QuickActionsCard() {
  return (
    <FadeUp className="lg:col-span-5">
      <DashboardCard>
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Quick Actions
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={cn(
                "flex flex-col items-start gap-3 rounded-xl p-4 text-left",
                "bg-foreground/[0.03] ring-1 ring-foreground/[0.05]",
                "transition-all duration-200",
                "hover:-translate-y-0.5 hover:bg-foreground/[0.06] hover:ring-[#7C3AED]/20"
              )}
            >
              <action.icon className="size-5 text-[#8B5CF6]" />
              <span className="text-sm font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </DashboardCard>
    </FadeUp>
  )
}
