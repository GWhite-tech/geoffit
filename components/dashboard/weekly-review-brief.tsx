"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { SectionLabel } from "@/components/ui/section-label"
import {
  useLatestWeeklyReview,
  type WeeklyReviewView,
} from "@/lib/health/weekly-review"

/**
 * Mission Control surface for the latest Weekly Review.
 *
 * Renders a deterministic empty placeholder until after mount so SSR HTML
 * matches hydration. Review data lives in localStorage and must not be read
 * during render.
 */
export function WeeklyReviewBrief() {
  const [mounted, setMounted] = useState(false)
  const review = useLatestWeeklyReview()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Server + first client paint: identical empty output.
  if (!mounted || !review?.hasData) return null

  return <WeeklyReviewBriefContent review={review} />
}

function WeeklyReviewBriefContent({ review }: { review: WeeklyReviewView }) {
  const change =
    review.score.change == null
      ? null
      : review.score.change > 0
        ? `+${review.score.change}`
        : review.score.change < 0
          ? `-${Math.abs(review.score.change)}`
          : "0"

  return (
    <section className="max-w-[40rem]">
      <SectionLabel className="text-[11px] tracking-[0.2em] text-muted-foreground/70">
        Weekly Review
      </SectionLabel>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-sans text-[32px] leading-tight font-semibold tracking-[-0.03em] text-foreground sm:text-[36px]">
            {review.bounds.label}
          </h2>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {review.bounds.rangeLabel}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
            Health Score
          </p>
          <p className="mt-1 text-[36px] font-semibold tracking-tight tabular-nums text-foreground">
            {review.score.score ?? "—"}
            {change ? (
              <span className="ml-2 text-[16px] font-medium text-muted-foreground">
                {change}
              </span>
            ) : null}
          </p>
        </div>
      </div>
      <p className="mt-6 line-clamp-3 text-[16px] leading-[1.75] text-foreground/80">
        {review.headline}
      </p>
      <Link
        href="/weekly-review"
        className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-foreground transition-colors hover:text-primary"
      >
        Read the briefing
        <ArrowUpRight className="size-4" />
      </Link>
    </section>
  )
}
