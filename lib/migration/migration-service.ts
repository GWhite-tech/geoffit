import { collectStoreStatistics } from "@/lib/settings/settings-actions"

import type {
  MigrationDomainEstimate,
  MigrationProgress,
  MigrationSummary,
} from "./types"

/**
 * Architecture-only migration planner.
 * Does not upload or mutate cloud health tables.
 */
export class MigrationService {
  plan(): MigrationSummary {
    const stats = safeStats()
    const domains: MigrationDomainEstimate[] = [
      {
        domain: "profile",
        label: "Profile",
        description: "Name, email, and identity already in Supabase Auth.",
        estimatedRecords: 1,
        status: "ready",
      },
      {
        domain: "preferences",
        label: "Preferences",
        description: "Theme, units, and notification defaults.",
        estimatedRecords: 1,
        status: "ready",
      },
      {
        domain: "measurements",
        label: "Measurements",
        description: "Weight, composition, and body metrics from local stores.",
        estimatedRecords: Math.max(0, Math.round(stats.healthRecords * 0.35)),
        status: stats.healthRecords > 0 ? "ready" : "empty",
      },
      {
        domain: "sleep",
        label: "Sleep",
        description: "Sleep sessions derived from health records.",
        estimatedRecords: Math.max(0, Math.round(stats.healthRecords * 0.2)),
        status: stats.healthRecords > 0 ? "ready" : "empty",
      },
      {
        domain: "nutrition",
        label: "Nutrition",
        description: "Daily nutrition totals and meals.",
        estimatedRecords: stats.nutritionDays,
        status: stats.nutritionDays > 0 ? "ready" : "empty",
      },
      {
        domain: "training",
        label: "Training",
        description: "Workouts and programme completions.",
        estimatedRecords: Math.max(0, Math.round(stats.healthRecords * 0.15)),
        status: "ready",
      },
      {
        domain: "blood",
        label: "Blood",
        description: "Panels, markers, and PDF lineage.",
        estimatedRecords: stats.bloodTests + stats.bloodMarkers,
        status: stats.bloodTests > 0 ? "ready" : "empty",
      },
      {
        domain: "treatments",
        label: "Treatments",
        description: "Treatment plans, doses, and inventory events.",
        estimatedRecords: stats.treatments + stats.doseEvents,
        status: stats.treatments > 0 || stats.doseEvents > 0 ? "ready" : "empty",
      },
      {
        domain: "reports",
        label: "Reports",
        description: "Weekly Review artifacts (derived — regenerable).",
        estimatedRecords: 0,
        status: "not_implemented",
      },
    ]

    const totalEstimatedRecords = domains.reduce(
      (sum, d) => sum + d.estimatedRecords,
      0
    )

    return {
      generatedAt: new Date().toISOString(),
      domains,
      totalEstimatedRecords,
      readyDomains: domains.filter((d) => d.status === "ready").length,
      blockedDomains: domains.filter((d) => d.status === "blocked").length,
      explanation:
        "This wizard estimates what would move from local IndexedDB / localStorage into Supabase. Nothing is uploaded yet. Health fact tables and sync workers ship in a later phase.",
    }
  }

  initialProgress(): MigrationProgress {
    return {
      phase: "idle",
      currentDomain: null,
      completedDomains: [],
      percent: 0,
      message: "Migration has not started.",
    }
  }
}

function safeStats() {
  try {
    return collectStoreStatistics()
  } catch {
    return {
      healthRecords: 0,
      nutritionDays: 0,
      bloodTests: 0,
      bloodMarkers: 0,
      treatments: 0,
      doseEvents: 0,
      conversations: 0,
    }
  }
}

export const migrationService = new MigrationService()
