"use client"

import { DailyBrief as DailyBriefCard } from "@/components/ui/daily-brief"
import { dailyBrief } from "@/lib/dashboard-data"

export function DailyBrief() {
  return <DailyBriefCard {...dailyBrief} />
}
