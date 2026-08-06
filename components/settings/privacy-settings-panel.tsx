"use client"

import Link from "next/link"
import { useTransition } from "react"

import { Button } from "@/components/ui/button"
import { runSettingsAction } from "@/lib/settings/settings-actions"

import { SettingsRow, SettingsSection } from "./settings-field"

export function PrivacySettingsPanel() {
  const [pending, startTransition] = useTransition()

  return (
    <div className="space-y-12">
      <SettingsSection title="Security">
        <SettingsRow label="Password" description="Update your sign-in password.">
          <Button render={<Link href="/account" />} variant="outline" className="h-9">
            Manage in Account
          </Button>
        </SettingsRow>
        <SettingsRow label="Sessions" description="Active browsers and devices.">
          <Button variant="outline" className="h-9" disabled>
            Coming soon
          </Button>
        </SettingsRow>
        <SettingsRow label="Connected devices">
          <Button variant="outline" className="h-9" disabled>
            Coming soon
          </Button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Privacy">
        <SettingsRow
          label="Privacy level"
          description="Privacy controls will live in a dedicated privacy preferences table — not user_preferences."
        >
          <p className="text-[13px] text-muted-foreground">Coming soon</p>
        </SettingsRow>
        <SettingsRow label="Export data" description="Download a local JSON export now.">
          <Button
            variant="outline"
            className="h-9"
            disabled={pending}
            onClick={() => {
              startTransition(() => {
                runSettingsAction("privacy.export")
              })
            }}
          >
            Export
          </Button>
        </SettingsRow>
        <SettingsRow label="Delete account">
          <Button variant="destructive" className="h-9" disabled>
            Disabled until migration
          </Button>
        </SettingsRow>
      </SettingsSection>
    </div>
  )
}
