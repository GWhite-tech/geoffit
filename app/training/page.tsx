import type { Metadata } from "next"

import { TrainingWorkspace } from "@/components/training/training-workspace"

export const metadata: Metadata = {
  title: "Training — Geoffit",
  description:
    "Training analytics centre — strength, fitness, and consistency over time.",
}

export default function TrainingPage() {
  return <TrainingWorkspace />
}
