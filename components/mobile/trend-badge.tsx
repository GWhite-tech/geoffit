import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react"

import { cn } from "@/lib/utils"

export type TrendDirection = "up" | "down" | "neutral"

const ICONS: Record<TrendDirection, typeof ArrowUp> = {
  up: ArrowUp,
  down: ArrowDown,
  neutral: ArrowRight,
}

/** Optional semantic override when “down” is good (e.g. weight, HbA1c). */
export function TrendBadge({
  direction,
  label,
  goodWhen = "up",
  className,
}: {
  direction: TrendDirection
  label?: string
  goodWhen?: "up" | "down" | "neutral"
  className?: string
}) {
  const Icon = ICONS[direction]
  const tone =
    direction === "neutral"
      ? "text-muted-foreground"
      : direction === goodWhen
        ? "text-success"
        : "text-danger"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[13px] font-medium tabular-nums",
        tone,
        className
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.5} aria-hidden />
      {label ? <span>{label}</span> : null}
    </span>
  )
}
