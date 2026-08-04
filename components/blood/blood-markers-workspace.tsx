"use client"

import { useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"

import { BloodContextSidebar } from "@/components/blood/blood-context-sidebar"
import { BloodMarkerNav } from "@/components/blood/blood-marker-nav"
import { BloodMarkerPanel } from "@/components/blood/blood-marker-panel"
import {
  useBloodNav,
  useDefaultBiomarkerId,
  useBloodStoreVersion,
} from "@/lib/health/blood/use-blood-markers"
import {
  BIOMARKER_REGISTRY,
  getBiomarkerDefinition,
} from "@/lib/health/biomarker-registry"

export function BloodMarkersWorkspace({
  biomarkerId,
}: {
  biomarkerId?: string
}) {
  const router = useRouter()
  const defaultId = useDefaultBiomarkerId()
  useBloodStoreVersion()
  const groups = useBloodNav("")

  const resolvedId =
    (biomarkerId && getBiomarkerDefinition(biomarkerId)?.id) ||
    defaultId ||
    BIOMARKER_REGISTRY[0]?.id ||
    null

  const mobileOptions = useMemo(
    () =>
      groups.flatMap((group) =>
        group.markers.map((marker) => ({
          id: marker.biomarker.id,
          label: `${marker.biomarker.shortName} · ${group.label}`,
        }))
      ),
    [groups]
  )

  useEffect(() => {
    if (biomarkerId) return
    if (defaultId) {
      router.replace(`/blood/${defaultId}`)
    }
  }, [biomarkerId, defaultId, router])

  function selectMarker(id: string) {
    router.push(`/blood/${id}`)
  }

  return (
    <div className="flex h-[calc(100svh-2.75rem)] w-full overflow-hidden">
      <div className="hidden h-full w-[320px] shrink-0 overflow-y-auto lg:block">
        <BloodMarkerNav activeId={resolvedId} onSelect={selectMarker} />
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="border-b border-border/30 px-5 py-3 lg:hidden">
          <label className="sr-only" htmlFor="blood-marker-select">
            Select blood marker
          </label>
          <select
            id="blood-marker-select"
            value={resolvedId ?? ""}
            onChange={(event) => selectMarker(event.target.value)}
            className="h-10 w-full rounded-xl border border-border/40 bg-card/30 px-3 text-[14px] text-foreground outline-none"
          >
            {mobileOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {resolvedId ? (
          <BloodMarkerPanel biomarkerId={resolvedId} />
        ) : (
          <div className="flex h-full items-center justify-center px-8 py-20">
            <p className="max-w-md text-center text-[15px] leading-relaxed text-muted-foreground">
              Import a blood test to begin tracking markers.
            </p>
          </div>
        )}
      </div>

      <div className="hidden h-full w-[280px] shrink-0 overflow-y-auto xl:block">
        <BloodContextSidebar />
      </div>
    </div>
  )
}
