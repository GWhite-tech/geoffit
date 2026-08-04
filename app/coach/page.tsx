import type { Metadata } from "next"

import { CoachWorkspace } from "@/components/coach/coach-workspace"

export const metadata: Metadata = {
  title: "AI Coach — Geoffit",
  description:
    "Geoffit's intelligence centre — grounded coaching from your complete health history.",
}

export default function CoachPage() {
  return <CoachWorkspace />
}
