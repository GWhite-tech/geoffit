import type { Metadata } from "next"

import { SettingsWorkspace } from "@/components/settings/settings-workspace"

export const metadata: Metadata = {
  title: "Settings — Geoffit",
  description: "Configure Geoffit — preferences, data sources, and privacy.",
}

export default function SettingsPage() {
  return <SettingsWorkspace />
}
