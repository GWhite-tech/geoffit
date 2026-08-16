import type { Metadata } from "next"

import { CoachClientDashboard } from "@/components/coaching/coach-client-dashboard"

export const metadata: Metadata = {
  title: "Client — Coaching — Geoffit",
  description: "Coach Mission Control for a shared client.",
}

type PageProps = {
  params: Promise<{ clientId: string }>
}

export default async function CoachingClientPage({ params }: PageProps) {
  const { clientId } = await params
  return <CoachClientDashboard clientId={clientId} />
}
