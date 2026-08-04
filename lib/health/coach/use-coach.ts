"use client"

import { useEffect, useMemo, useSyncExternalStore } from "react"

import { getBloodStore, getHealthStore, useHealthHydrated } from "@/lib/health"
import { getNutritionStore } from "@/lib/health/nutrition/nutrition-store"
import { getTreatmentStore } from "@/lib/health/treatment/treatment-store"

import { buildCoachHealthContext } from "./coach-context-engine"
import { buildCoachMemory } from "./coach-memory"
import {
  detectTopic,
  generateCoachResponse,
  titleForQuestion,
} from "./coach-response-engine"
import { getCoachStore } from "./coach-store"
import { getConversationStore } from "./conversation-store"
import type {
  CoachConversation,
  CoachHealthContext,
  CoachMemorySnapshot,
  CoachMessage,
} from "./types"
import { COACH_SUGGESTED_QUESTIONS } from "./types"

function subscribe(onStoreChange: () => void) {
  const unsubs = [
    getHealthStore().subscribe(onStoreChange),
    getBloodStore().subscribe(onStoreChange),
    getNutritionStore().subscribe(onStoreChange),
    getTreatmentStore().subscribe(onStoreChange),
    getCoachStore().subscribe(onStoreChange),
    getConversationStore().subscribe(onStoreChange),
  ]
  return () => {
    for (const unsub of unsubs) unsub()
  }
}

function getVersion(): number {
  return (
    getHealthStore().getRecordCount() * 100_000 +
    getBloodStore().getTestCount() * 1_000 +
    getNutritionStore().getVersion() * 10 +
    getTreatmentStore().getVersion() +
    getCoachStore().getVersion() +
    getConversationStore().getVersion()
  )
}

function getServerVersion(): number {
  return 0
}

function syncNutrition(): void {
  getNutritionStore().syncFromHealthRecords(getHealthStore().getAll())
}

function rebuildContext(): CoachHealthContext {
  syncNutrition()
  const context = buildCoachHealthContext({
    records: getHealthStore().getAll(),
    bloodTests: getBloodStore().getAll(),
    nutritionDays: getNutritionStore().getDays(),
    nutritionTargets: getNutritionStore().getTargets(),
    treatments: getTreatmentStore().getTreatments(),
    events: getTreatmentStore().getEvents(),
  })
  const memory = buildCoachMemory(context)
  getCoachStore().setContext(context, memory)
  return context
}

export function useCoachBootstrap(): void {
  const hydrated = useHealthHydrated()

  useEffect(() => {
    getConversationStore().hydrateFromStorage()
    getBloodStore().hydrateFromStorage()
    getTreatmentStore().hydrateFromStorage()
    getNutritionStore().hydrateFromStorage()
  }, [])

  useEffect(() => {
    if (!hydrated) return
    // Defer — coach context embeds Progress analytics and must not block paint.
    const run = () => {
      rebuildContext()
    }
    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions
      ) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (typeof idleWindow.requestIdleCallback === "function") {
      const id = idleWindow.requestIdleCallback(run, { timeout: 1200 })
      return () => idleWindow.cancelIdleCallback?.(id)
    }
    const timer = globalThis.setTimeout(run, 0)
    return () => globalThis.clearTimeout(timer)
  }, [hydrated])
}

export function useCoachContext(): {
  context: CoachHealthContext | null
  memory: CoachMemorySnapshot | null
} {
  useCoachBootstrap()
  const version = useSyncExternalStore(subscribe, getVersion, getServerVersion)
  const hydrated = useHealthHydrated()

  return useMemo(() => {
    const store = getCoachStore()
    // Never sync-rebuild during render — bootstrap fills context after hydrate.
    if (!hydrated) {
      return { context: null, memory: null }
    }
    return {
      context: store.getContext(),
      memory: store.getMemory(),
    }
  }, [version, hydrated])
}

export function useCoachConversations(search = ""): CoachConversation[] {
  useCoachBootstrap()
  const version = useSyncExternalStore(subscribe, getVersion, getServerVersion)
  return useMemo(() => {
    return getConversationStore().search(search)
  }, [version, search])
}

export function useActiveConversation(): CoachConversation | null {
  useCoachBootstrap()
  const version = useSyncExternalStore(subscribe, getVersion, getServerVersion)
  return useMemo(() => getConversationStore().getActive(), [version])
}

export function useCoachComposing(): boolean {
  const version = useSyncExternalStore(subscribe, getVersion, getServerVersion)
  return useMemo(() => getCoachStore().isComposing(), [version])
}

export function askCoach(question: string): void {
  const trimmed = question.trim()
  if (!trimmed) return

  const context = rebuildContext()
  const conversationStore = getConversationStore()
  const coachStore = getCoachStore()

  const userMessage: CoachMessage = {
    id: `user-${Math.random().toString(36).slice(2, 10)}`,
    role: "user",
    createdAt: new Date().toISOString(),
    text: trimmed,
    blocks: [],
    followUps: [],
  }

  coachStore.setComposing(true)

  // Yield so UI can show composing state before heavy work.
  window.setTimeout(() => {
    const reply = generateCoachResponse({ question: trimmed, context })
    const active = conversationStore.getActive()
    if (!active) {
      conversationStore.createConversation({
        title: titleForQuestion(trimmed),
        topic: detectTopic(trimmed),
        firstUserMessage: userMessage,
        firstCoachMessage: reply,
      })
    } else {
      conversationStore.appendMessages(active.id, [userMessage, reply])
    }
    coachStore.setComposing(false)
  }, 180)
}

export function selectConversation(id: string): void {
  getConversationStore().setActive(id)
}

export function startNewConversation(): void {
  getConversationStore().setActive(null)
}

export function renameConversation(id: string, title: string): void {
  getConversationStore().rename(id, title)
}

export function togglePinConversation(id: string): void {
  getConversationStore().togglePin(id)
}

export function deleteConversation(id: string): void {
  getConversationStore().deleteConversation(id)
}

export function getSuggestedQuestions(): readonly string[] {
  return COACH_SUGGESTED_QUESTIONS
}
