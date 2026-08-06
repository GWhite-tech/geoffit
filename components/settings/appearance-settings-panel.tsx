"use client"

import { usePreferences } from "@/components/preferences/preferences-provider"
import { Input } from "@/components/ui/input"

import { ChoiceRow, SettingsRow, SettingsSection } from "./settings-field"

export function AppearanceSettingsPanel() {
  const { preferences, updatePreferences } = usePreferences()
  if (!preferences) {
    return <p className="text-[14px] text-muted-foreground">Loading preferences…</p>
  }

  return (
    <div className="space-y-12">
      <SettingsSection title="Theme">
        <SettingsRow label="Appearance" description="Light, dark, or follow the system.">
          <ChoiceRow
            value={preferences.theme}
            onChange={(value) =>
              void updatePreferences({
                theme: value as "light" | "dark" | "system",
              })
            }
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "System" },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Accent colour">
          <Input
            type="color"
            value={preferences.accent_colour}
            onChange={(e) =>
              void updatePreferences({ accent_colour: e.target.value })
            }
            className="h-10 w-24 border-border/40 bg-card/30 p-1"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Layout">
        <SettingsRow label="Font scaling">
          <ChoiceRow
            value={preferences.font_scaling}
            onChange={(value) =>
              void updatePreferences({
                font_scaling: value as "default" | "large" | "xl",
              })
            }
            options={[
              { value: "default", label: "Default" },
              { value: "large", label: "Large" },
              { value: "xl", label: "XL" },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Density">
          <ChoiceRow
            value={preferences.density}
            onChange={(value) =>
              void updatePreferences({
                density: value as "comfortable" | "compact",
              })
            }
            options={[
              { value: "comfortable", label: "Comfortable" },
              { value: "compact", label: "Compact" },
            ]}
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  )
}
