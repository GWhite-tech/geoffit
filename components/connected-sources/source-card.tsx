"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import type { ConnectedSourceView } from "@/lib/connected-sources"
import { cn } from "@/lib/utils"

function statusLabel(status: ConnectedSourceView["status"]) {
  switch (status) {
    case "connected":
      return "Connected"
    case "manual":
      return "Manual"
    case "error":
      return "Error"
    case "pending":
      return "Pending"
    case "coming_soon":
      return "Coming soon"
    default:
      return "Not connected"
  }
}

export function SourceCard({
  source,
  compact,
}: {
  source: ConnectedSourceView
  compact?: boolean
}) {
  const tone =
    source.status === "connected" || source.status === "manual"
      ? "text-emerald-600 dark:text-emerald-400"
      : source.status === "error"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground"

  return (
    <div
      className={cn(
        "rounded-xl border border-border/40 bg-card/30",
        compact ? "p-4" : "p-5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-medium text-foreground">{source.name}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {source.description}
          </p>
        </div>
        <span className={cn("shrink-0 text-[12px] font-medium", tone)}>
          {statusLabel(source.status)}
        </span>
      </div>

      <dl className="mt-4 grid gap-2 text-[13px] sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Last sync</dt>
          <dd className="text-foreground">
            {source.lastSyncAt
              ? new Date(source.lastSyncAt).toLocaleString()
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Permissions</dt>
          <dd className="text-foreground">
            {source.permissions.length
              ? source.permissions.join(", ")
              : "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {source.canSync ? (
          <Button
            render={<Link href="/import" />}
            variant="outline"
            size="sm"
            className="h-8"
          >
            Sync
          </Button>
        ) : null}
        {source.status === "disconnected" ? (
          <Button render={<Link href="/import" />} size="sm" className="h-8">
            Connect
          </Button>
        ) : null}
        {source.status === "coming_soon" ? (
          <Button size="sm" variant="ghost" className="h-8" disabled>
            Unavailable
          </Button>
        ) : null}
        {source.canDisconnect ? (
          <Button size="sm" variant="ghost" className="h-8" disabled>
            Disconnect
          </Button>
        ) : null}
      </div>
    </div>
  )
}
