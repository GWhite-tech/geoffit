"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { useProfile } from "@/hooks/auth"
import { usePreferences } from "@/components/preferences/preferences-provider"

import { ChoiceRow, SettingsRow, SettingsSection } from "./settings-field"

export function ProfileSettingsPanel() {
  const { profile, greetingName } = useProfile()
  const { preferences, updatePreferences } = usePreferences()
  const display =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    greetingName

  return (
    <div className="space-y-12">
      <SettingsSection title="Identity">
        <SettingsRow label="Avatar" description="Photo sync arrives with storage migration.">
          <Avatar className="size-14 after:border-border/40">
            {profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={display} />
            ) : null}
            <AvatarFallback className="bg-card text-[15px]">
              {(display || "G").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </SettingsRow>
        <SettingsRow label="Display name">
          <Input
            readOnly
            value={display}
            className="h-10 w-full min-w-[200px] border-border/40 bg-card/30"
          />
        </SettingsRow>
        <SettingsRow label="Email">
          <Input
            readOnly
            value={profile?.email ?? ""}
            className="h-10 w-full min-w-[200px] border-border/40 bg-card/30"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Region">
        <SettingsRow label="Timezone" description="Used for reminders and daily boundaries.">
          <Input
            value={preferences?.timezone ?? ""}
            onChange={(e) => void updatePreferences({ timezone: e.target.value })}
            className="h-10 w-full min-w-[200px] border-border/40 bg-card/30"
          />
        </SettingsRow>
        <SettingsRow label="Language">
          <ChoiceRow
            value={preferences?.locale ?? "en-GB"}
            onChange={(value) => void updatePreferences({ locale: value })}
            options={[
              { value: "en-GB", label: "English (UK)" },
              { value: "en-US", label: "English (US)" },
            ]}
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  )
}
