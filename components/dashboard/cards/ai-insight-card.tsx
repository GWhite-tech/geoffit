"use client"

import { Brain, Sparkles } from "lucide-react"

import { FadeUp } from "@/components/dashboard/motion/stagger"
import { DashboardCard } from "@/components/dashboard/ui/dashboard-card"
import { Badge } from "@/components/ui/badge"
import { aiInsight } from "@/lib/dashboard-data"

export function AiInsightCard() {
  return (
    <FadeUp className="lg:col-span-7">
      <DashboardCard accent="violet">
        <div className="flex gap-5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7C3AED]/20 to-[#6D28D9]/10 ring-1 ring-[#7C3AED]/25">
            <Brain className="size-5 text-[#8B5CF6]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
                AI Insight
              </p>
              <Badge
                variant="secondary"
                className="gap-1 bg-[#7C3AED]/10 text-[#8B5CF6] ring-1 ring-[#7C3AED]/20"
              >
                <Sparkles className="size-3" />
                Personalized
              </Badge>
            </div>
            <p className="mt-3 text-base leading-relaxed text-foreground/90 sm:text-lg">
              {aiInsight.body}
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              {aiInsight.footnote}
            </p>
          </div>
        </div>
      </DashboardCard>
    </FadeUp>
  )
}
