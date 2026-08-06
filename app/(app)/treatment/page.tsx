import type { Metadata } from "next"

import { TreatmentWorkspace } from "@/components/treatment/treatment-workspace"

export const metadata: Metadata = {
  title: "Treatments — Geoffit",
  description:
    "Weekly treatment planner for prescriptions, peptides, and supplements.",
}

export default function TreatmentPage() {
  return <TreatmentWorkspace />
}
