"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

import { MiniTrendSparkline } from "@/components/dashboard/mission-control/mini-trend-sparkline"
import { SectionLabel } from "@/components/ui/section-label"
import type { BloodMarkerTrendCard } from "@/lib/health/analytics"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function BloodMarkersSection({
  markers,
}: {
  markers: BloodMarkerTrendCard[]
}) {
  return (
    <section className="space-y-6">
      <div>
        <SectionLabel>Blood Markers</SectionLabel>
        <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
          Lab trends across tests — open a marker to explore the full blood
          history.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transitions.fadeUp, delay: 0.04 }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {markers.map((marker) => (
          <Link
            key={marker.id}
            href={marker.href}
            className="mc-card group flex min-h-[168px] flex-col px-6 py-6 transition-colors hover:bg-card/55"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/65 uppercase">
                {marker.label}
              </p>
            </div>

            {marker.available ? (
              <>
                <div className="mt-5 flex flex-1 items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[28px] leading-none font-medium tracking-tight text-foreground sm:text-[32px]">
                      {marker.latestDisplay}
                    </p>
                    {marker.statusLabel ? (
                      <p
                        className={cn(
                          "mt-2.5 text-[13px] font-medium",
                          marker.statusColorClass ?? "text-muted-foreground"
                        )}
                      >
                        {marker.statusLabel}
                      </p>
                    ) : null}
                    {marker.labReferenceDisplay ? (
                      <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground/65">
                        Lab reference:
                        <br />
                        {marker.labReferenceDisplay}
                      </p>
                    ) : null}
                    {marker.latestDateLabel ? (
                      <p className="mt-2 text-[12px] text-muted-foreground/55">
                        {marker.latestDateLabel}
                      </p>
                    ) : null}
                  </div>
                  <MiniTrendSparkline
                    data={marker.sparkline}
                    className="mb-0.5 shrink-0"
                  />
                </div>
                {marker.changeDisplay ? (
                  <p className="mt-4 text-[13px] text-muted-foreground">
                    {marker.changeDisplay}
                  </p>
                ) : (
                  <p className="mt-4 text-[13px] text-muted-foreground/55">
                    First reading
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="mt-5 text-[28px] leading-none font-medium text-muted-foreground/55">
                  Coming soon
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground/55">
                  {marker.emptyHint}
                </p>
              </>
            )}
          </Link>
        ))}
      </motion.div>

      <div className="pt-1">
        <Link
          href="/blood"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary transition-colors hover:text-primary-hover"
        >
          View all blood test history
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  )
}
