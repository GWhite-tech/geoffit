"use client"

import Link from "next/link"
import { Moon } from "lucide-react"

import { SleepAiBrief } from "@/components/sleep/sleep-ai-brief"
import { SleepConsistency } from "@/components/sleep/sleep-consistency"
import { SleepOverview } from "@/components/sleep/sleep-overview"
import { SleepRecoverySignals } from "@/components/sleep/sleep-recovery-signals"
import { SleepStages } from "@/components/sleep/sleep-stages"
import { SleepTrend, useSleepTrendRange } from "@/components/sleep/sleep-trend"
import { EmptyState } from "@/components/ui/empty-state"
import { useSleepSummary } from "@/lib/health/sleep"

export function SleepPage() {
  const [range, setRange] = useSleepTrendRange("30d")
  const summary = useSleepSummary(range)

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1120px] flex-col gap-14 px-6 py-10 lg:gap-16 lg:px-10 lg:py-12">
      <header className="space-y-3">
        <h1 className="text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
          Sleep
        </h1>
        <p className="max-w-xl text-base text-muted-foreground">
          Understand your recovery and sleep quality over time.
        </p>
      </header>

      {!summary.hasData ? (
        <EmptyState
          icon={Moon}
          title={summary.emptyState?.title ?? "No sleep data yet"}
          description={
            summary.emptyState?.description ??
            "Import Sleep Analysis from Apple Health to open your sleep intelligence."
          }
          action={
            <Link
              href="/import"
              className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Open Data Sources
            </Link>
          }
        />
      ) : null}

      <SleepOverview overview={summary.overview} />
      <SleepStages stages={summary.stages} />
      <SleepTrend
        trend={summary.trend}
        range={range}
        onRangeChange={setRange}
      />
      <SleepConsistency calendar={summary.consistencyCalendar} />
      <SleepRecoverySignals signals={summary.recoverySignals} />
      <SleepAiBrief brief={summary.aiBrief} />
    </div>
  )
}
