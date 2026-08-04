"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"

import { getBloodStore, getHealthStore, useHealthHydrated } from "@/lib/health"
import {
  buildBiomarkerHistory,
  buildBloodNavGroups,
  listBiomarkersWithData,
  type BloodChartRange,
  type BiomarkerHistorySummary,
} from "@/lib/health/blood/biomarker-history"
import type { BiomarkerDefinition } from "@/lib/health/biomarker-registry"

function subscribeBlood(onStoreChange: () => void) {
  return getBloodStore().subscribe(onStoreChange)
}

function subscribeHealth(onStoreChange: () => void) {
  const unsubHealth = getHealthStore().subscribe(onStoreChange)
  const unsubBlood = getBloodStore().subscribe(onStoreChange)
  return () => {
    unsubHealth()
    unsubBlood()
  }
}

function getBloodVersion(): number {
  return getBloodStore().getTestCount() * 100 + getBloodStore().getMarkerCount()
}

function getHealthVersion(): number {
  return (
    getHealthStore().getRecordCount() * 1000 + getBloodStore().getTestCount()
  )
}

function getServerVersion(): number {
  return 0
}

export function useBloodStoreVersion(): number {
  const version = useSyncExternalStore(
    subscribeBlood,
    getBloodVersion,
    getServerVersion
  )
  const [tick, setTick] = useState(0)

  useEffect(() => {
    getBloodStore().hydrateFromStorage()
    setTick((value) => value + 1)
  }, [])

  return version + tick
}

export function useHealthAndBloodVersion(): number {
  const version = useSyncExternalStore(
    subscribeHealth,
    getHealthVersion,
    getServerVersion
  )
  const hydrated = useHealthHydrated()

  useEffect(() => {
    getBloodStore().hydrateFromStorage()
  }, [])

  // Stay at 0 until health hydrate so sidebar skips full-record walks.
  return hydrated ? version : 0
}

export function useBiomarkerHistory(
  biomarkerId: string,
  range: BloodChartRange = "all"
): BiomarkerHistorySummary | null {
  const version = useBloodStoreVersion()
  return useMemo(() => {
    return buildBiomarkerHistory(getBloodStore().getAll(), biomarkerId, range)
  }, [biomarkerId, range, version])
}

export function useBloodMarkerIndex(): Array<{
  category: string
  label: string
  entries: Array<{
    biomarker: BiomarkerDefinition
    summary: BiomarkerHistorySummary
  }>
}> {
  const version = useBloodStoreVersion()
  return useMemo(() => {
    const tests = getBloodStore().getAll()
    return buildBloodNavGroups(tests)
      .map((group) => ({
        category: group.id,
        label: group.label,
        entries: group.markers
          .filter((m) => m.hasData)
          .map((m) => ({ biomarker: m.biomarker, summary: m.summary })),
      }))
      .filter((group) => group.entries.length > 0)
  }, [version])
}

export function useBloodNav(search: string) {
  const version = useBloodStoreVersion()
  return useMemo(() => {
    const groups = buildBloodNavGroups(getBloodStore().getAll())
    const q = search.trim().toLowerCase()
    if (!q) return groups
    return groups
      .map((group) => ({
        ...group,
        markers: group.markers.filter(
          (m) =>
            m.biomarker.displayName.toLowerCase().includes(q) ||
            m.biomarker.shortName.toLowerCase().includes(q) ||
            m.biomarker.id.includes(q)
        ),
      }))
      .filter((group) => group.markers.length > 0)
  }, [version, search])
}

export function useDefaultBiomarkerId(): string | null {
  const version = useBloodStoreVersion()
  return useMemo(() => {
    const withData = listBiomarkersWithData(getBloodStore().getAll())
    if (withData[0]) return withData[0].biomarker.id
    return null
  }, [version])
}
