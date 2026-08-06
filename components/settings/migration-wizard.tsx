"use client"

import { useMemo, useState } from "react"

import { ResponsiveCard } from "@/components/layout/responsive-card"
import { Button } from "@/components/ui/button"
import { migrationService } from "@/lib/migration"
import { cn } from "@/lib/utils"

export function MigrationWizard() {
  const summary = useMemo(() => migrationService.plan(), [])
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-medium text-foreground">
            Import local data
          </p>
          <p className="mt-1 max-w-xl text-[13px] text-muted-foreground">
            Architecture preview only — no upload runs yet.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide wizard" : "Open wizard"}
        </Button>
      </div>

      {open ? (
        <ResponsiveCard className="space-y-5">
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            {summary.explanation}
          </p>
          <p className="text-[13px] text-muted-foreground">
            Estimated records · {summary.totalEstimatedRecords.toLocaleString()} ·{" "}
            {summary.readyDomains} domains ready
          </p>
          <ol className="space-y-3">
            {summary.domains.map((domain, index) => (
              <li
                key={domain.domain}
                className="flex items-start justify-between gap-4 border-b border-border/25 pb-3 last:border-0"
              >
                <div>
                  <p className="text-[14px] font-medium text-foreground">
                    {index + 1}. {domain.label}
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {domain.description}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-[12px] text-foreground">
                    {domain.estimatedRecords.toLocaleString()}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-[11px] uppercase tracking-wide",
                      domain.status === "ready" &&
                        "text-emerald-600 dark:text-emerald-400",
                      domain.status === "empty" && "text-muted-foreground",
                      domain.status === "not_implemented" &&
                        "text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {domain.status.replace("_", " ")}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <Button type="button" className="h-10" disabled>
            Start migration (not available yet)
          </Button>
        </ResponsiveCard>
      ) : null}
    </div>
  )
}
