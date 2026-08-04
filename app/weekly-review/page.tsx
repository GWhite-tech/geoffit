import type { Metadata } from "next"

import { WeeklyReviewWorkspace } from "@/components/weekly-review/weekly-review-workspace"

export const metadata: Metadata = {
  title: "Weekly Review — Geoffit",
  description:
    "Your executive health briefing — the week summarised like a letter from an elite coach.",
}

export default function WeeklyReviewPage() {
  return <WeeklyReviewWorkspace />
}
