"use client"

import { useStoreStatistics } from "@/lib/settings"

const APP_VERSION = "0.1.0"
const DATABASE_VERSION = "health-idb.v1 · settings.v1 · treatments.v1"

export function AboutPanel() {
  const stats = useStoreStatistics()

  return (
    <div className="space-y-10">
      <dl className="divide-y divide-border/25">
        <Row label="Application version" value={APP_VERSION} />
        <Row label="Database version" value={DATABASE_VERSION} />
        <Row
          label="Health records"
          value={stats.healthRecords.toLocaleString("en-GB")}
        />
        <Row
          label="Latest sync"
          value="See Data Sources for per-connector activity"
        />
        <Row label="Last backup" value="Use Export all data under Privacy" />
        <Row label="Licences" value="Open-source licences ship with the build" />
        <Row label="Release notes" value="Tracked in repository changelog" />
      </dl>
      <p className="max-w-xl text-[14px] leading-relaxed text-muted-foreground">
        Geoffit — your health operating system. Settings are designed to support
        multiple users, family accounts, and coach access without redesigning
        this page.
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 py-4 sm:grid-cols-[200px_1fr] sm:gap-6">
      <dt className="text-[14px] text-muted-foreground">{label}</dt>
      <dd className="text-[15px] text-foreground">{value}</dd>
    </div>
  )
}
