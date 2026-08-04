"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"

import { getBloodStore, getHealthStore } from "@/lib/health"
import { getConversationStore } from "@/lib/health/coach/conversation-store"
import { getNutritionStore } from "@/lib/health/nutrition/nutrition-store"
import { getTreatmentStore } from "@/lib/health/treatment/treatment-store"

import {
  collectStoreStatistics,
  getLiveDataSources,
  runSettingsAction,
} from "./settings-actions"
import { getSettingsStore } from "./settings-store"
import { searchPreferences } from "./preference-search"
import type {
  DataSourceStatus,
  PreferenceValue,
  SettingsCategoryId,
  SettingsSearchHit,
  StoreStatistics,
} from "./types"

function subscribe(onStoreChange: () => void) {
  const unsubs = [
    getSettingsStore().subscribe(onStoreChange),
    getHealthStore().subscribe(onStoreChange),
    getBloodStore().subscribe(onStoreChange),
    getNutritionStore().subscribe(onStoreChange),
    getTreatmentStore().subscribe(onStoreChange),
    getConversationStore().subscribe(onStoreChange),
  ]
  return () => {
    for (const unsub of unsubs) unsub()
  }
}

function getVersion(): number {
  return (
    getSettingsStore().getVersion() * 100_000 +
    getHealthStore().getRecordCount() * 100 +
    getBloodStore().getTestCount() * 10 +
    getNutritionStore().getVersion() +
    getTreatmentStore().getVersion()
  )
}

function getServerVersion(): number {
  return 0
}

export function useSettingsBootstrap(): void {
  const [, setTick] = useState(0)
  useEffect(() => {
    getSettingsStore().hydrateFromStorage()
    getBloodStore().hydrateFromStorage()
    getTreatmentStore().hydrateFromStorage()
    getNutritionStore().hydrateFromStorage()
    getConversationStore().hydrateFromStorage()
    void getHealthStore()
      .hydrateFromStorageAsync()
      .then(() => setTick((value) => value + 1))
    setTick((value) => value + 1)
  }, [])
}

export function useActiveSettingsCategory(): {
  category: SettingsCategoryId
  setCategory: (category: SettingsCategoryId) => void
} {
  useSettingsBootstrap()
  const version = useSyncExternalStore(subscribe, getVersion, getServerVersion)
  return useMemo(
    () => ({
      category: getSettingsStore().getActiveCategory(),
      setCategory: (category) => getSettingsStore().setActiveCategory(category),
    }),
    [version]
  )
}

export function usePreferenceValue(id: string): {
  value: PreferenceValue
  setValue: (value: PreferenceValue) => void
} {
  useSettingsBootstrap()
  const version = useSyncExternalStore(subscribe, getVersion, getServerVersion)
  return useMemo(
    () => ({
      value: getSettingsStore().getValue(id),
      setValue: (value) => getSettingsStore().setValue(id, value),
    }),
    [version, id]
  )
}

export function useSettingsSearch(query: string): SettingsSearchHit[] {
  useSettingsBootstrap()
  return useMemo(() => searchPreferences(query), [query])
}

export function useDataSources(): DataSourceStatus[] {
  useSettingsBootstrap()
  const version = useSyncExternalStore(subscribe, getVersion, getServerVersion)
  return useMemo(() => getLiveDataSources(), [version])
}

export function useStoreStatistics(): StoreStatistics {
  useSettingsBootstrap()
  const version = useSyncExternalStore(subscribe, getVersion, getServerVersion)
  return useMemo(() => collectStoreStatistics(), [version])
}

export function useSettingsAction(): (actionId: string) => string {
  return (actionId) => runSettingsAction(actionId)
}
