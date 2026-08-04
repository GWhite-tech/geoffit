"use client"

import { useState } from "react"

import { PreferenceField } from "@/components/settings/preference-field"
import {
  preferencesForCategory,
  useSettingsAction,
  useStoreStatistics,
} from "@/lib/settings"

export function AdvancedPanel() {
  const stats = useStoreStatistics()
  const runAction = useSettingsAction()
  const [message, setMessage] = useState<string | null>(null)
  const preferences = preferencesForCategory("advanced")

  const sections = groupBySection(preferences)

  return (
    <div className="space-y-12">
      {Object.entries(sections).map(([section, items]) => (
        <section key={section}>
          <h3 className="text-[13px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
            {section}
          </h3>
          <div className="mt-2 divide-y divide-border/25">
            {items.map((preference) => (
              <PreferenceField key={preference.id} preference={preference} />
            ))}
          </div>
        </section>
      ))}

      <section>
        <h3 className="text-[13px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
          Database statistics
        </h3>
        <dl className="mt-4 divide-y divide-border/25">
          <Stat label="HealthStore records" value={stats.healthRecords} />
          <Stat label="NutritionStore days" value={stats.nutritionDays} />
          <Stat label="BloodStore tests" value={stats.bloodTests} />
          <Stat label="Blood markers" value={stats.bloodMarkers} />
          <Stat label="Treatments" value={stats.treatments} />
          <Stat label="Dose events" value={stats.doseEvents} />
          <Stat label="Coach conversations" value={stats.conversations} />
        </dl>
      </section>

      <section className="space-y-3">
        <h3 className="text-[13px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
          Maintenance
        </h3>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            label="Clear cache"
            onClick={() => setMessage(runAction("advanced.clear_cache"))}
          />
          <ActionButton
            label="Rebuild analytics"
            onClick={() => setMessage(runAction("advanced.rebuild_analytics"))}
          />
        </div>
        {message ? (
          <p className="text-[13px] text-muted-foreground">{message}</p>
        ) : null}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <dt className="text-[15px] text-foreground">{label}</dt>
      <dd className="text-[15px] font-medium tabular-nums text-foreground">
        {value.toLocaleString("en-GB")}
      </dd>
    </div>
  )
}

function ActionButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border/50 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      {label}
    </button>
  )
}

function groupBySection<T extends { section: string }>(
  items: T[]
): Record<string, T[]> {
  const map: Record<string, T[]> = {}
  for (const item of items) {
    const list = map[item.section] ?? []
    list.push(item)
    map[item.section] = list
  }
  return map
}
