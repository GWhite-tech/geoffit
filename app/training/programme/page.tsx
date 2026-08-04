import type { Metadata } from "next"

import { ProgrammeWorkspace } from "@/components/programme/programme-workspace"

export const metadata: Metadata = {
  title: "Programme — Geoffit",
  description:
    "Active training block — coached progression, adherence, and programme story.",
}

export default function ProgrammePage() {
  return <ProgrammeWorkspace />
}
