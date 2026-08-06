"use client"

import { ArrowDown, ArrowUp } from "lucide-react"

import type { WhatsChangedItem } from "@/lib/mission-control/presentation"

export function WhatsChangedSection({
  items,
}: {
  items: WhatsChangedItem[]
}) {
  if (items.length === 0) return null

  return (
    <section className="space-y-3">
      <p className="text-[12px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        What’s Changed
      </p>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-card/30 px-3.5 text-[14px] font-medium text-foreground"
          >
            {item.label}
            {item.direction === "up" ? (
              <ArrowUp
                className="size-3.5 text-muted-foreground"
                strokeWidth={2.5}
                aria-label="up"
              />
            ) : (
              <ArrowDown
                className="size-3.5 text-muted-foreground"
                strokeWidth={2.5}
                aria-label="down"
              />
            )}
            <span className="sr-only">{item.direction}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
