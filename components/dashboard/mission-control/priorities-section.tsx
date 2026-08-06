"use client"

import Link from "next/link"

import { SectionLabel } from "@/components/ui/section-label"
import type { MissionControlPriority } from "@/lib/mission-control/view-model"

/** Only renders when real priorities exist — never placeholder copy. */
export function PrioritiesSection({
  priorities,
}: {
  priorities: MissionControlPriority[]
}) {
  if (priorities.length === 0) return null

  return (
    <section className="space-y-4">
      <SectionLabel>Today’s priorities</SectionLabel>
      <ul className="space-y-1">
        {priorities.map((item) => {
          const row = (
            <span className="flex min-h-11 items-center gap-3 rounded-xl px-1 text-[16px] text-foreground">
              <span
                className="size-1.5 shrink-0 rounded-full bg-foreground/70"
                aria-hidden
              />
              {item.label}
            </span>
          )
          return (
            <li key={item.id}>
              {item.href ? <Link href={item.href}>{row}</Link> : row}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
