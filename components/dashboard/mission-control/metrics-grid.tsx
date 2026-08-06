"use client"

import Link from "next/link"

import type { MissionControlMetric } from "@/lib/mission-control/view-model"

/** Compact metrics — callers must pass only present values (no "—"). */
export function MetricsGrid({ metrics }: { metrics: MissionControlMetric[] }) {
  if (metrics.length === 0) return null

  return (
    <section className="space-y-3">
      <p className="text-[12px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        Today’s Metrics
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {metrics.map((metric) => {
          const body = (
            <div className="flex min-h-[84px] flex-col justify-between rounded-2xl bg-card/30 px-3.5 py-3">
              <p className="text-[12px] font-medium text-muted-foreground">
                {metric.label}
              </p>
              <div>
                <p className="text-[22px] font-semibold tracking-tight text-foreground tabular-nums">
                  {metric.value}
                  {metric.unit ? (
                    <span className="ml-1 text-[12px] font-normal text-muted-foreground">
                      {metric.unit}
                    </span>
                  ) : null}
                </p>
                {metric.hint ? (
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground/75">
                    {metric.hint}
                  </p>
                ) : null}
              </div>
            </div>
          )
          return metric.href ? (
            <Link
              key={metric.id}
              href={metric.href}
              className="block min-h-11 rounded-2xl transition-colors active:bg-card/50"
            >
              {body}
            </Link>
          ) : (
            <div key={metric.id}>{body}</div>
          )
        })}
      </div>
    </section>
  )
}
