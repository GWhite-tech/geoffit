import type { Metadata } from "next"

import { NutritionDayDetail } from "@/components/nutrition/day-detail"

type PageProps = {
  params: Promise<{ date: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { date } = await params
  return {
    title: `${date} — Nutrition — Geoffit`,
  }
}

export default async function NutritionDayPage({ params }: PageProps) {
  const { date } = await params
  return <NutritionDayDetail date={date} />
}
