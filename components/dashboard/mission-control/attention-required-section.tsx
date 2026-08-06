"use client"

import Link from "next/link"

import type { MissionControlPriority } from "@/lib/mission-control/view-model"

/** Attention Required — only when the VM has real attention items. */
export function AttentionRequiredSection({
  items,
}: {
  items: MissionControlPriority[]
}) {
  if (items.length === 0) return null

  return (
    <section className="space-y-3">
      <p className="text-[12px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        Attention Required
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const row = (
            <span className="flex min-h-11 items-center gap-3 py-1 text-[16px] font-medium text-foreground">
              <span
                className="size-1.5 shrink-0 rounded-full bg-warning"
                aria-hidden
              />
              {item.label}
            </span>
          )
          return (
            <li key={item.id}>
              {item.href ? (
                <Link href={item.href} className="block rounded-xl px-1 -mx-1 active:bg-card/40">
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
