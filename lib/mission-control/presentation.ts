/**
 * Presentation selectors over MissionControlViewModel.
 * No store access / no duplicate analytics — filter & format for UI only.
 */

import type { MissionControlViewModel } from "./view-model"

export type WhatsChangedItem = {
  id: string
  label: string
  direction: "up" | "down"
}

/** 1–2 useful sentences from the VM brief; empty → hide Today's Brief body. */
export function selectBriefSentences(
  vm: MissionControlViewModel
): string[] {
  return vm.dailyBrief.lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 2)
}

export function hasUsefulBrief(vm: MissionControlViewModel): boolean {
  return selectBriefSentences(vm).length > 0 || vm.dailyBrief.personalized
}

/** Short health-score caption from explanation — first clause only. */
export function selectHealthScoreCaption(
  vm: MissionControlViewModel
): string | null {
  const raw = vm.healthScore.explanation?.trim()
  if (!raw) return null
  const first = raw.split(/(?<=\.)\s+/)[0]?.trim()
  if (!first) return null
  return first.length > 72 ? `${first.slice(0, 69).trimEnd()}…` : first
}

export function selectAttentionItems(vm: MissionControlViewModel) {
  return vm.priorities
}

export function selectPresentMetrics(vm: MissionControlViewModel) {
  return vm.metrics.filter((metric) => {
    const value = metric.value?.trim()
    if (!value) return false
    if (value === "—" || value === "-" || value === "–") return false
    return true
  })
}

/** Meaningful movement only — ignore flat / missing change. */
export function selectWhatsChanged(
  vm: MissionControlViewModel
): WhatsChangedItem[] {
  const items: WhatsChangedItem[] = []

  const weight = vm.bodyComposition.series.find((s) => s.id === "weight")
  if (weight?.available && weight.points.length >= 2) {
    const first = weight.points[0]!.value
    const last = weight.points[weight.points.length - 1]!.value
    if (last < first) {
      items.push({ id: "weight", label: "Weight", direction: "down" })
    } else if (last > first) {
      items.push({ id: "weight", label: "Weight", direction: "up" })
    }
  }

  const bodyFat = vm.bodyComposition.series.find((s) => s.id === "body_fat")
  if (bodyFat?.available && bodyFat.points.length >= 2) {
    const first = bodyFat.points[0]!.value
    const last = bodyFat.points[bodyFat.points.length - 1]!.value
    if (last < first) {
      items.push({ id: "body_fat", label: "Body Fat", direction: "down" })
    } else if (last > first) {
      items.push({ id: "body_fat", label: "Body Fat", direction: "up" })
    }
  }

  for (const card of vm.recovery) {
    if (!card.available || !card.trendDisplay) continue
    const up = /↑|\+/u.test(card.trendDisplay)
    const down = /↓|-/u.test(card.trendDisplay)
    if (!up && !down) continue
    const label = /hrv/i.test(card.label)
      ? "HRV"
      : /sleep/i.test(card.label)
        ? "Sleep"
        : /recovery/i.test(card.label)
          ? "Recovery"
          : card.label
    items.push({
      id: card.id,
      label,
      direction: up ? "up" : "down",
    })
  }

  for (const marker of vm.bloodHighlights) {
    if (!marker.available) continue
    if (marker.changeDirection !== "up" && marker.changeDirection !== "down") {
      continue
    }
    items.push({
      id: marker.id,
      label: marker.label,
      direction: marker.changeDirection,
    })
  }

  // Dedupe by label, keep first
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = item.label.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 6)
}

export function hasBodyChart(vm: MissionControlViewModel): boolean {
  return vm.bodyComposition.series.some(
    (series) => series.available && series.points.length > 0
  )
}

export function availableRecovery(vm: MissionControlViewModel) {
  return vm.recovery.filter((card) => card.available && card.latestDisplay)
}

export function availableTraining(vm: MissionControlViewModel) {
  return vm.training.filter((card) => card.available && card.latestDisplay)
}
