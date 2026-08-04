"use client"

import Link from "next/link"

import { SectionLabel } from "@/components/ui/section-label"
import { useCoachContext } from "@/lib/health/coach"
import { formatProgressDateLong } from "@/lib/health/progress"
import { useLatestWeeklyReview } from "@/lib/health/weekly-review"

export function CoachContextSidebar() {
  const { context } = useCoachContext()
  const weeklyReview = useLatestWeeklyReview()

  const rows = [
    {
      label: "Current weight",
      value: context?.currentWeight?.display ?? "—",
      href: "/progress",
    },
    {
      label: "Health Score",
      value:
        context?.healthScore?.score != null
          ? String(context.healthScore.score)
          : "—",
      href: "/progress",
    },
    {
      label: "Recovery",
      value:
        context?.recovery?.score != null
          ? `${context.recovery.score}%`
          : "—",
      href: "/progress",
    },
    {
      label: "Current protocol",
      value: context?.currentProtocol ?? "—",
      href: "/treatment",
    },
    {
      label: "Medications",
      value:
        context?.medications.length
          ? context.medications.map((m) => m.name).join(", ")
          : "—",
      href: "/treatment",
    },
    {
      label: "Protein average",
      value: context?.proteinAverage?.display ?? "—",
      href: "/nutrition",
    },
    {
      label: "Calories average",
      value: context?.caloriesAverage?.display ?? "—",
      href: "/nutrition",
    },
    {
      label: "Sleep average",
      value: context?.sleepAverage?.display ?? "—",
      href: "/sleep",
    },
    {
      label: "Latest blood test",
      value: context?.latestBloodTest
        ? `${formatProgressDateLong(context.latestBloodTest.date)} · ${context.latestBloodTest.panel}`
        : "—",
      href: "/blood",
    },
    {
      label: "Last workout",
      value: context?.lastWorkout
        ? `${context.lastWorkout.label} · ${context.lastWorkout.sourcesLabel}`
        : "—",
      href: null,
    },
  ]

  return (
    <aside className="flex h-full w-full flex-col border-l border-border/30 px-5 pt-8 pb-8">
      <SectionLabel>Health Context</SectionLabel>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
        Always visible. The coach uses this automatically — nothing to attach.
      </p>

      {weeklyReview?.hasData ? (
        <Link
          href="/weekly-review"
          className="mt-6 block rounded-xl border border-border/40 px-4 py-4 transition-colors hover:border-border/70"
        >
          <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground/70 uppercase">
            Weekly Review
          </p>
          <p className="mt-2 text-[16px] font-medium tracking-tight text-foreground">
            {weeklyReview.bounds.label}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Score {weeklyReview.score.score ?? "—"}
            {weeklyReview.score.change != null
              ? ` · ${weeklyReview.score.change > 0 ? "+" : ""}${weeklyReview.score.change}`
              : ""}
          </p>
        </Link>
      ) : null}

      <ul className="mt-8 space-y-5">
        {rows.map((row) => {
          const body = (
            <>
              <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground/70 uppercase">
                {row.label}
              </p>
              <p className="mt-1.5 text-[15px] leading-snug font-medium tracking-tight text-foreground">
                {row.value}
              </p>
            </>
          )
          return (
            <li key={row.label}>
              {row.href ? (
                <Link
                  href={row.href}
                  className="block transition-colors hover:text-primary"
                >
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
