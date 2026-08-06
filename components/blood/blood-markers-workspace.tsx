"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"

import { BloodContextSidebar } from "@/components/blood/blood-context-sidebar"
import { BloodMarkerNav } from "@/components/blood/blood-marker-nav"
import { BloodMarkerPanel } from "@/components/blood/blood-marker-panel"
import { BloodMobileList } from "@/components/blood/blood-mobile-list"
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

  const hasAnyMarker = useMemo(
    () => groups.some((group) => group.markers.length > 0),
    [groups]
  )

  function selectMarker(id: string) {
    router.push(`/blood/${id}`)
  }

  // Mobile: list at /blood, detail at /blood/[id]
  if (!biomarkerId) {
    return (
      <>
        <BloodMobileList />
        <div className="hidden h-[calc(100svh-2.75rem)] w-full overflow-hidden md:flex">
          <div className="hidden h-full w-[320px] shrink-0 overflow-y-auto lg:block">
            <BloodMarkerNav activeId={resolvedId} onSelect={selectMarker} />
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto">
            {resolvedId && hasAnyMarker ? (
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
      </>
    )
  }

  return (
    <>
      <div className="md:hidden">
        <div className="mx-auto w-full max-w-[390px] px-5 pt-4">
          <Link
            href="/blood"
            className="inline-flex min-h-11 items-center gap-1 text-[16px] font-medium text-foreground"
          >
            <ChevronLeft className="size-5" />
            Blood
          </Link>
        </div>
        <BloodMarkerPanel biomarkerId={biomarkerId} />
      </div>

      <div className="hidden h-[calc(100svh-2.75rem)] w-full overflow-hidden md:flex">
        <div className="hidden h-full w-[320px] shrink-0 overflow-y-auto lg:block">
          <BloodMarkerNav activeId={resolvedId} onSelect={selectMarker} />
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto">
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
    </>
  )
}
