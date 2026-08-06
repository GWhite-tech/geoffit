"use client"

import { useCallback, useEffect, useState } from "react"

import { useUser } from "@/hooks/auth"
import {
  BOOTSTRAP_VERSION,
  readBootstrapState,
  type BootstrapDomainDebug,
  type BootstrapDomainResult,
  type BootstrapState,
} from "@/lib/health/bootstrap/bootstrap-state"
import { getBloodStore, getHealthStore } from "@/lib/health"
import { getWorkoutStore } from "@/lib/health/workout"

function fmt(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return "n/a"
  return value ? "true" : "false"
}

function fmtText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "n/a"
  return String(value)
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-2 text-[13px]">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="break-all text-right font-mono text-foreground">
        {value}
      </span>
    </div>
  )
}

function DomainBlock({
  title,
  status,
  debug,
}: {
  title: string
  status: BootstrapDomainResult | undefined
  debug: BootstrapDomainDebug | undefined
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-[15px] font-semibold">{title}</h2>
      <Row label="Bootstrap status" value={status ?? "not run"} />
      <Row label="Ingest Run ID" value={fmtText(debug?.ingestRunId)} />
      <Row label="Replay artefact found" value={fmt(debug?.replayFound)} />
      <Row
        label="Replay artefact path"
        value={fmtText(debug?.replayArtefactPath)}
      />
      <Row label="Replay item count" value={fmtText(debug?.replayItemCount)} />
      <Row
        label="Replay download attempted"
        value={fmt(debug?.replayDownloadAttempted)}
      />
      <Row
        label="Replay download succeeded"
        value={fmt(debug?.replayDownloadSucceeded)}
      />
      <Row label="Fallback used" value={fmt(debug?.fallbackUsed)} />
      <Row
        label="retryDocumentIngest() called"
        value={fmt(debug?.retryCalled)}
      />
      <Row
        label="retryDocumentIngest() succeeded"
        value={fmt(debug?.retrySucceeded)}
      />
      <Row
        label="confirmParsedImport() called"
        value={fmt(debug?.confirmCalled)}
      />
      <Row label="Store ingest called" value={fmt(debug?.storeIngestCalled)} />
      <Row label="Final store count" value={fmtText(debug?.finalStoreCount)} />
      <Row label="Last error" value={fmtText(debug?.lastError)} />
    </section>
  )
}

export function BootstrapDebugPanel() {
  const { user, loading } = useUser()
  const [state, setState] = useState<BootstrapState | null>(null)
  const [bloodCount, setBloodCount] = useState(0)
  const [workoutCount, setWorkoutCount] = useState(0)
  const [healthCount, setHealthCount] = useState(0)

  const refresh = useCallback(() => {
    if (!user) {
      setState(null)
      return
    }
    getBloodStore().hydrateFromStorage()
    getWorkoutStore().hydrateFromStorage()
    void getHealthStore().hydrateFromStorageAsync().then(() => {
      setHealthCount(getHealthStore().getRecordCount())
    })
    setState(readBootstrapState(user.id))
    setBloodCount(getBloodStore().getTestCount())
    setWorkoutCount(getWorkoutStore().getAll().length)
  }, [user])

  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, 2000)
    return () => window.clearInterval(id)
  }, [refresh])

  if (loading) {
    return (
      <div className="p-4 text-[14px] text-muted-foreground">Loading…</div>
    )
  }

  if (!user) {
    return (
      <div className="p-4 text-[14px] text-muted-foreground">
        Sign in required. Open this page in a session where you are logged in.
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4 pb-16">
      <header>
        <h1 className="text-[20px] font-semibold tracking-tight">
          Bootstrap debug
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Temporary diagnostics only. Auto-refreshes every 2s.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-[15px] font-semibold">Overview</h2>
        <Row label="HealthStore record count" value={String(healthCount)} />
        <Row label="BloodStore test count" value={String(bloodCount)} />
        <Row label="Workout count" value={String(workoutCount)} />
        <Row label="Bootstrap version" value={String(BOOTSTRAP_VERSION)} />
        <Row
          label="Last bootstrap run time"
          value={state?.lastRunAt ?? "never"}
        />
      </section>

      <DomainBlock
        title="Blood bootstrap"
        status={state?.results.blood}
        debug={state?.debug?.blood}
      />
      <DomainBlock
        title="Hevy bootstrap"
        status={state?.results.hevy}
        debug={state?.debug?.hevy}
      />

      <button
        type="button"
        onClick={refresh}
        className="rounded-md border border-border px-3 py-2 text-[13px]"
      >
        Refresh now
      </button>
    </div>
  )
}
