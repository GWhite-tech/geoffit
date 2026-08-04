"use client"

import Link from "next/link"

import { useDataSources } from "@/lib/settings"
import { cn } from "@/lib/utils"

export function DataSourcesPanel() {
  const sources = useDataSources()
  const connected = sources.filter((source) => source.status !== "coming_soon")
  const future = sources.filter((source) => source.status === "coming_soon")

  return (
    <div className="space-y-12">
      <section className="space-y-6">
        <div>
          <h3 className="text-[13px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
            Connected & manual
          </h3>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
            Every source feeding Geoffit. Connect, re-import, or review history.
          </p>
        </div>

        <ul className="divide-y divide-border/25">
          {connected.map((source) => (
            <li
              key={source.id}
              className="flex flex-wrap items-start justify-between gap-4 py-5"
            >
              <div className="min-w-0">
                <p className="text-[16px] font-medium tracking-tight text-foreground">
                  {source.name}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  <StatusLabel status={source.status} />
                  {source.detail ? ` · ${source.detail}` : ""}
                </p>
                {source.lastActivityLabel ? (
                  <p className="mt-1 text-[13px] text-muted-foreground/80">
                    {source.lastActivityLabel}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {source.actions.includes("connect") ||
                source.actions.includes("reimport") ||
                source.actions.includes("sync") ? (
                  <Link
                    href="/import"
                    className="rounded-full border border-border/50 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {source.actions.includes("sync")
                      ? "Sync / Import"
                      : source.actions.includes("reimport")
                        ? "Re-import"
                        : "Connect"}
                  </Link>
                ) : null}
                {source.actions.includes("history") ? (
                  <Link
                    href="/import"
                    className="rounded-full px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Import history
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-6">
        <div>
          <h3 className="text-[13px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
            Future connectors
          </h3>
        </div>
        <ul className="divide-y divide-border/20">
          {future.map((source) => (
            <li
              key={source.id}
              className="flex items-center justify-between gap-4 py-4"
            >
              <p className="text-[15px] text-foreground/80">{source.name}</p>
              <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                Soon
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function StatusLabel({
  status,
}: {
  status: "connected" | "manual" | "available" | "coming_soon"
}) {
  return (
    <span
      className={cn(
        status === "connected" && "text-success",
        status === "manual" && "text-foreground",
        status === "available" && "text-muted-foreground"
      )}
    >
      {status === "connected"
        ? "Connected"
        : status === "manual"
          ? "Manual"
          : status === "available"
            ? "Available"
            : "Coming soon"}
    </span>
  )
}
