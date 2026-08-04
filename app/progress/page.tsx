import type { Metadata } from "next"

import { ProgressWorkspace } from "@/components/progress/progress-workspace"

export const metadata: Metadata = {
  title: "Progress — Geoffit",
  description:
    "Longitudinal health analytics — am I getting healthier over time?",
}

export default function ProgressPage() {
  return <ProgressWorkspace />
}
