import type { Metadata } from "next"
import { Suspense } from "react"

import { CoachingHub } from "@/components/coaching/coaching-hub"

export const metadata: Metadata = {
  title: "Coaching — Geoffit",
  description: "Invite Coaches and manage shared client access.",
}

export default function CoachingPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-[14px] text-muted-foreground">Loading…</div>
      }
    >
      <CoachingHub />
    </Suspense>
  )
}
