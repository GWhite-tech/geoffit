import type { Metadata } from "next"

import { SleepPage } from "@/components/sleep/sleep-page"

export const metadata: Metadata = {
  title: "Sleep — Geoffit",
  description: "Understand your recovery and sleep quality over time.",
}

export default function SleepRoutePage() {
  return <SleepPage />
}
