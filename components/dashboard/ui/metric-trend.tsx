import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"

interface MetricTrendProps {
  value: string
  positive?: boolean
  className?: string
}

export function MetricTrend({
  value,
  positive = true,
  className,
}: MetricTrendProps) {
  const Icon = positive ? ArrowDownRight : ArrowUpRight

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        positive ? "text-status-positive" : "text-amber-400",
        className
      )}
    >
      <Icon className="size-3" />
      {value}
    </span>
  )
}
