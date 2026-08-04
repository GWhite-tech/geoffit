import type { Metadata } from "next"

import { BloodMarkersWorkspace } from "@/components/blood/blood-markers-workspace"

export const metadata: Metadata = {
  title: "Blood Markers — Geoffit",
  description:
    "Longitudinal blood marker analytics — trends, reference ranges, and health context.",
}

export default function BloodPage() {
  return <BloodMarkersWorkspace />
}
