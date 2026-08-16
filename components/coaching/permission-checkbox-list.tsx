"use client"

import { COACH_PERMISSION_CATEGORIES } from "@/lib/coach/categories"
import type { CoachPermissionCategory } from "@/lib/coach/categories"
import { coachPermissionCopy } from "@/lib/coach/ui-labels"
import { cn } from "@/lib/utils"

export function PermissionCheckboxList({
  selected,
  onChange,
  disabled,
}: {
  selected: readonly CoachPermissionCategory[]
  onChange: (next: CoachPermissionCategory[]) => void
  disabled?: boolean
}) {
  function toggle(category: CoachPermissionCategory) {
    if (disabled) return
    if (selected.includes(category)) {
      onChange(selected.filter((c) => c !== category))
    } else {
      onChange([...selected, category])
    }
  }

  return (
    <ul className="space-y-3">
      {COACH_PERMISSION_CATEGORIES.map((category) => {
        const copy = coachPermissionCopy(category)
        const checked = selected.includes(category)
        return (
          <li key={category}>
            <label
              className={cn(
                "flex cursor-pointer gap-3 rounded-xl border px-3 py-3 transition-colors",
                checked
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/40 bg-card/20 hover:bg-card/40",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              <input
                type="checkbox"
                className="mt-1 size-4 accent-primary"
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(category)}
              />
              <span className="min-w-0">
                <span className="block text-[14px] font-medium text-foreground">
                  {copy.label}
                </span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">
                  {copy.description}
                </span>
              </span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}

export function PermissionChips({
  permissions,
}: {
  permissions: readonly CoachPermissionCategory[]
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {permissions.map((p) => (
        <span
          key={p}
          className="rounded-full border border-border/40 bg-card/40 px-2.5 py-0.5 text-[12px] text-muted-foreground"
        >
          {coachPermissionCopy(p).label}
        </span>
      ))}
    </div>
  )
}
