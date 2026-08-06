import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BloodMarkersWorkspace } from "@/components/blood/blood-markers-workspace"
import {
  BIOMARKER_REGISTRY,
  getBiomarkerDefinition,
} from "@/lib/health/biomarker-registry"

type PageProps = {
  params: Promise<{ biomarkerId: string }>
}

export async function generateStaticParams() {
  return BIOMARKER_REGISTRY.map((biomarker) => ({
    biomarkerId: biomarker.id,
  }))
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { biomarkerId } = await params
  const def = getBiomarkerDefinition(biomarkerId)
  return {
    title: def
      ? `${def.displayName} — Blood Markers — Geoffit`
      : "Blood Markers — Geoffit",
    description: def?.description,
  }
}

export default async function BiomarkerPage({ params }: PageProps) {
  const { biomarkerId } = await params
  if (!getBiomarkerDefinition(biomarkerId)) notFound()
  return <BloodMarkersWorkspace biomarkerId={biomarkerId} />
}
