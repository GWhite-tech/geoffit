"use client"

import { Lock } from "lucide-react"

import type { CoachPermissionCategory } from "@/lib/coach/categories"
import { coachPermissionCopy } from "@/lib/coach/ui-labels"
import { cn } from "@/lib/utils"

export function CategoryLockCard({
  category,
  className,
}: {
  category: CoachPermissionCategory
  className?: string
}) {
  const copy = coachPermissionCopy(category)
  return (
    <div
      className={cn(
        "rounded-xl border border-border/30 bg-card/20 px-4 py-5",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-muted/40">
          <Lock className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-foreground">
            {copy.label} not granted
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            This client has not shared {copy.label.toLowerCase()} access with
            you.
          </p>
        </div>
      </div>
    </div>
  )
}
