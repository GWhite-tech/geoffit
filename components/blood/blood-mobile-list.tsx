"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"

import { BiomarkerCell, MobilePage } from "@/components/mobile"
import { Input } from "@/components/ui/input"
import {
  useBloodNav,
  useBloodStoreVersion,
} from "@/lib/health/blood/use-blood-markers"
import { formatBiomarkerValue } from "@/lib/health/biomarker-registry"

function statusToneFromColour(
  colour: string | undefined
): "high" | "low" | "normal" | "attention" | "unknown" | "neutral" {
  if (colour === "green") return "normal"
  if (colour === "amber") return "attention"
  if (colour === "red") return "high"
  return "unknown"
}

export function BloodMobileList() {
  useBloodStoreVersion()
  const [search, setSearch] = useState("")
  const groups = useBloodNav(search)

  const total = useMemo(
    () => groups.reduce((sum, group) => sum + group.markers.length, 0),
    [groups]
  )

  return (
    <MobilePage
      title="Blood"
      subtitle="Search markers, spot highs and lows, open any biomarker."
      className="md:hidden"
    >
      <div className="relative mb-6">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground/55"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search biomarkers"
          className="h-12 rounded-2xl border-white/8 bg-white/[0.04] pl-10 text-[16px] shadow-none"
        />
      </div>

      {total === 0 ? (
        <p className="px-1 text-[15px] leading-relaxed text-muted-foreground">
          Import a blood test to begin tracking markers.
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.id}>
              <h2 className="mb-1 px-1 text-[13px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                {group.label}
              </h2>
              <div>
                {group.markers.map(({ biomarker, summary, hasData }) => {
                  const latest = summary.analytics.latest
                  const trend = summary.analytics.trendDirection
                  const value =
                    latest != null
                      ? formatBiomarkerValue(biomarker.id, latest.value)
                      : "—"
                  return (
                    <BiomarkerCell
                      key={biomarker.id}
                      href={`/blood/${biomarker.id}`}
                      name={biomarker.displayName}
                      value={hasData ? value : "No data"}
                      status={latest?.status.label ?? null}
                      statusTone={statusToneFromColour(latest?.status.colour)}
                      trend={
                        !hasData
                          ? undefined
                          : trend === "up" ||
                              trend === "down" ||
                              trend === "neutral"
                            ? trend
                            : undefined
                      }
                    />
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </MobilePage>
  )
}
