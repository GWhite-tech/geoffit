"use client"

import { SettingsRow, SettingsSection } from "./settings-field"

export function NotificationsSettingsPanel() {
  return (
    <div className="space-y-12">
      <SettingsSection title="Channels">
        <SettingsRow
          label="Notification preferences"
          description="Channel toggles, quiet hours, and categories will live in notification_preferences (Notifications domain)."
        >
          <p className="text-[13px] text-muted-foreground">Coming soon</p>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Reminders">
        <SettingsRow
          label="Categories"
          description="Workout, meds, weekly review, blood tests, inventory, and sync reminders arrive with the Notifications domain."
        >
          <p className="text-[13px] text-muted-foreground">Coming soon</p>
        </SettingsRow>
      </SettingsSection>
    </div>
  )
}
