"use client"

import Link from "next/link"
import { ArrowDown, ArrowUp } from "lucide-react"

import { selectHealthScoreCaption } from "@/lib/mission-control/presentation"
import type { MissionControlViewModel } from "@/lib/mission-control/view-model"
import { cn } from "@/lib/utils"

export function HealthScoreStrip({ vm }: { vm: MissionControlViewModel }) {
  const score = vm.healthScore
  if (score.score == null) return null

  const delta = score.change30d
  const caption = selectHealthScoreCaption(vm)

  return (
    <Link
      href="/progress"
      className="block rounded-3xl bg-card/35 px-5 py-6 transition-colors active:bg-card/50 sm:px-7 sm:py-8"
    >
      <p className="text-[12px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        Health Score
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-2">
        <p className="text-[64px] leading-none font-semibold tracking-tight tabular-nums text-foreground sm:text-[72px]">
          {score.score}
        </p>
        {delta != null && delta !== 0 ? (
          <p
            className={cn(
              "mb-2 inline-flex items-center gap-1 text-[15px] font-medium tabular-nums",
              delta > 0 ? "text-success" : "text-danger"
            )}
          >
            {delta > 0 ? (
              <ArrowUp className="size-4" strokeWidth={2.5} aria-hidden />
            ) : (
              <ArrowDown className="size-4" strokeWidth={2.5} aria-hidden />
            )}
            {delta > 0 ? `+${delta}` : delta} this period
          </p>
        ) : null}
      </div>
      {caption ? (
        <p className="mt-4 max-w-[32ch] text-[15px] leading-snug text-muted-foreground">
          {caption}
        </p>
      ) : null}
    </Link>
  )
}
