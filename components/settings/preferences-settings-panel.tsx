"use client"

import { usePreferences } from "@/components/preferences/preferences-provider"

import { ChoiceRow, SettingsRow, SettingsSection } from "./settings-field"

export function PreferencesSettingsPanel() {
  const { preferences, updatePreferences } = usePreferences()
  if (!preferences) {
    return <p className="text-[14px] text-muted-foreground">Loading preferences…</p>
  }

  return (
    <div className="space-y-12">
      <SettingsSection title="Units">
        <SettingsRow label="System">
          <ChoiceRow
            value={preferences.units}
            onChange={(value) => {
              const units = value as "metric" | "imperial"
              void updatePreferences({
                units,
                preferred_weight_unit: units === "imperial" ? "lb" : "kg",
                preferred_distance_unit: units === "imperial" ? "mi" : "km",
                preferred_temperature_unit: units === "imperial" ? "f" : "c",
              })
            }}
            options={[
              { value: "metric", label: "Metric" },
              { value: "imperial", label: "Imperial" },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Weight">
          <ChoiceRow
            value={preferences.preferred_weight_unit}
            onChange={(value) =>
              void updatePreferences({
                preferred_weight_unit: value as "kg" | "lb",
              })
            }
            options={[
              { value: "kg", label: "kg" },
              { value: "lb", label: "lb" },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Distance">
          <ChoiceRow
            value={preferences.preferred_distance_unit}
            onChange={(value) =>
              void updatePreferences({
                preferred_distance_unit: value as "km" | "mi",
              })
            }
            options={[
              { value: "km", label: "km" },
              { value: "mi", label: "mi" },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Energy">
          <ChoiceRow
            value={preferences.preferred_energy_unit}
            onChange={(value) =>
              void updatePreferences({
                preferred_energy_unit: value as "kcal" | "kj",
              })
            }
            options={[
              { value: "kcal", label: "kcal" },
              { value: "kj", label: "kJ" },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Blood glucose">
          <ChoiceRow
            value={preferences.preferred_blood_glucose_unit}
            onChange={(value) =>
              void updatePreferences({
                preferred_blood_glucose_unit: value as "mmol_l" | "mg_dl",
              })
            }
            options={[
              { value: "mmol_l", label: "mmol/L" },
              { value: "mg_dl", label: "mg/dL" },
            ]}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Calendar">
        <SettingsRow label="Date format">
          <ChoiceRow
            value={preferences.date_format}
            onChange={(value) => void updatePreferences({ date_format: value })}
            options={[
              { value: "dd MMM yyyy", label: "05 Aug 2026" },
              { value: "MM/dd/yyyy", label: "08/05/2026" },
              { value: "yyyy-MM-dd", label: "2026-08-05" },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Week start">
          <ChoiceRow
            value={preferences.week_start}
            onChange={(value) =>
              void updatePreferences({
                week_start: value as "monday" | "sunday",
              })
            }
            options={[
              { value: "monday", label: "Monday" },
              { value: "sunday", label: "Sunday" },
            ]}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Dashboard">
        <SettingsRow label="Layout">
          <ChoiceRow
            value={preferences.dashboard_layout}
            onChange={(value) =>
              void updatePreferences({
                dashboard_layout: value as "classic" | "compact" | "focus",
              })
            }
            options={[
              { value: "classic", label: "Classic" },
              { value: "compact", label: "Compact" },
              { value: "focus", label: "Focus" },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Landing page">
          <ChoiceRow
            value={preferences.default_dashboard}
            onChange={(value) =>
              void updatePreferences({ default_dashboard: value })
            }
            options={[
              { value: "mission-control", label: "Mission Control" },
              { value: "weekly-review", label: "Weekly Review" },
              { value: "training", label: "Training" },
            ]}
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  )
}
