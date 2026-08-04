import { getBloodStore, getHealthStore } from "@/lib/health"
import { getConversationStore } from "@/lib/health/coach/conversation-store"
import { getNutritionStore } from "@/lib/health/nutrition/nutrition-store"
import { getTreatmentStore } from "@/lib/health/treatment/treatment-store"
import { getWorkoutStore } from "@/lib/health/workout"

import { buildDataSourceStatuses } from "./data-sources"
import type { StoreStatistics } from "./types"

export function collectStoreStatistics(): StoreStatistics {
  return {
    healthRecords: getHealthStore().getRecordCount(),
    nutritionDays: getNutritionStore().getDays().length,
    bloodTests: getBloodStore().getTestCount(),
    bloodMarkers: getBloodStore().getMarkerCount(),
    treatments: getTreatmentStore().getTreatments().length,
    doseEvents: getTreatmentStore().getEvents().length,
    conversations: getConversationStore().getConversations().length,
  }
}

export function getLiveDataSources() {
  return buildDataSourceStatuses({
    healthRecords: getHealthStore().getAll(),
    bloodTests: getBloodStore().getAll(),
    hevyWorkouts: getWorkoutStore().getAll(),
  })
}

export function runSettingsAction(actionId: string): string {
  switch (actionId) {
    case "privacy.export": {
      const payload = {
        exportedAt: new Date().toISOString(),
        healthRecordCount: getHealthStore().getRecordCount(),
        bloodTests: getBloodStore().getAll(),
        nutritionDays: getNutritionStore().getDays(),
        nutritionTargets: getNutritionStore().getTargets(),
        treatments: getTreatmentStore().getTreatments(),
        doseEvents: getTreatmentStore().getEvents(),
        statistics: collectStoreStatistics(),
      }
      if (typeof window !== "undefined") {
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement("a")
        anchor.href = url
        anchor.download = `geoffit-export-${new Date().toISOString().slice(0, 10)}.json`
        anchor.click()
        URL.revokeObjectURL(url)
      }
      return "Export downloaded."
    }
    case "coach.reset_memory": {
      // Clear conversation history — coach memory today is conversation-scoped.
      const store = getConversationStore()
      for (const conversation of store.getConversations()) {
        store.deleteConversation(conversation.id)
      }
      return "AI Coach conversations cleared."
    }
    case "advanced.clear_cache":
    case "advanced.rebuild_analytics": {
      getNutritionStore().forceSyncFromHealthRecords(getHealthStore().getAll())
      return "Analytics rebuilt from HealthStore."
    }
    case "profile.photo":
    case "privacy.password":
    case "privacy.2fa":
    case "privacy.sessions":
    case "privacy.devices":
    case "privacy.delete":
      return "Coming soon."
    default:
      return "Action unavailable."
  }
}
