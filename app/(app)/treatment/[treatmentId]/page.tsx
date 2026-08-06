import type { Metadata } from "next"

import { TreatmentDetail } from "@/components/treatment/treatment-detail"

type PageProps = {
  params: Promise<{ treatmentId: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { treatmentId } = await params
  const title =
    treatmentId
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "Treatment"
  return {
    title: `${title} — Treatments — Geoffit`,
  }
}

export default async function TreatmentDetailPage({ params }: PageProps) {
  const { treatmentId } = await params
  return <TreatmentDetail treatmentId={treatmentId} />
}
