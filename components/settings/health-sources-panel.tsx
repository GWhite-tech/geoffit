"use client"

import { useMemo } from "react"

import { SourceCard } from "@/components/connected-sources/source-card"
import { AdaptiveGrid } from "@/components/layout/adaptive-grid"
import { listConnectedSourceViews } from "@/lib/connected-sources"

export function HealthSourcesPanel() {
  const sources = useMemo(() => listConnectedSourceViews(), [])

  const primary = sources.filter((s) =>
    ["apple_health", "hevy", "withings", "cronometer", "myfitnesspal", "manual", "csv"].includes(
      s.id
    )
  )

  return (
    <div className="space-y-6">
      <p className="max-w-xl text-[14px] leading-relaxed text-muted-foreground">
        Connect the systems that feed Geoffit. Sync and disconnect actions are
        ready for the Connected Sources framework — live APIs land per provider.
      </p>
      <AdaptiveGrid cols={1}>
        {primary.map((source) => (
          <SourceCard key={source.id} source={source} />
        ))}
      </AdaptiveGrid>
    </div>
  )
}
