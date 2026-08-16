import type { Metadata } from "next"
import { Suspense } from "react"

import { AcceptInvitationPanel } from "@/components/coaching/accept-invitation-panel"

export const metadata: Metadata = {
  title: "Accept Coach invitation — Geoffit",
  description: "Accept a Geoffit Coach invitation.",
}

export default function CoachingAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-[14px] text-muted-foreground">Loading…</div>
      }
    >
      <AcceptInvitationPanel />
    </Suspense>
  )
}
