"use client"

import {
  IMPORT_PROFILE_METRICS,
  type ImportProfileMetricId,
  type ImportProfileToggles,
} from "@/lib/importers/apple-health/import-profile"
import { cn } from "@/lib/utils"

interface ImportProfilePanelProps {
  profile: ImportProfileToggles
  onChange: (profile: ImportProfileToggles) => void
  disabled?: boolean
}

export function ImportProfilePanel({
  profile,
  onChange,
  disabled = false,
}: ImportProfilePanelProps) {
  const enabled = IMPORT_PROFILE_METRICS.filter((metric) => profile[metric.id])
  const disabledMetrics = IMPORT_PROFILE_METRICS.filter(
    (metric) => !profile[metric.id]
  )

  const toggle = (id: ImportProfileMetricId) => {
    if (disabled) return
    onChange({ ...profile, [id]: !profile[id] })
  }

  return (
    <div className="surface-functional p-6 lg:p-7">
      <p className="text-[13px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
        Import profile
      </p>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
        Only enabled record types are fully parsed. High-volume types like Heart
        Rate stay off by default for faster imports.
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-[12px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Enabled
          </p>
          <ul className="mt-3 space-y-2">
            {enabled.map((metric) => (
              <li key={metric.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 text-[14px] text-foreground",
                    disabled && "cursor-default opacity-60"
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked
                    disabled={disabled}
                    onChange={() => toggle(metric.id)}
                  />
                  <span>✓ {metric.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[12px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Disabled
          </p>
          <ul className="mt-3 space-y-2">
            {disabledMetrics.map((metric) => (
              <li key={metric.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 text-[14px] text-muted-foreground",
                    disabled && "cursor-default opacity-60"
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={false}
                    disabled={disabled}
                    onChange={() => toggle(metric.id)}
                  />
                  <span>☐ {metric.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
