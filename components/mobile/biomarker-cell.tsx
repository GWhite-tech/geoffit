import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { TrendBadge, type TrendDirection } from "@/components/mobile/trend-badge"
import { cn } from "@/lib/utils"

export function BiomarkerCell({
  href,
  name,
  value,
  status,
  statusTone = "neutral",
  trend,
  className,
}: {
  href: string
  name: string
  value: string
  status?: string | null
  statusTone?: "high" | "low" | "normal" | "attention" | "unknown" | "neutral"
  trend?: TrendDirection
  className?: string
}) {
  const statusColor =
    statusTone === "high" || statusTone === "low" || statusTone === "attention"
      ? statusTone === "attention"
        ? "text-warning"
        : "text-danger"
      : statusTone === "normal"
        ? "text-success"
        : "text-muted-foreground"

  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[56px] items-center gap-3 border-b border-white/[0.05] px-1 py-3.5 transition-colors active:bg-white/[0.03]",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-medium tracking-tight text-foreground">
          {name}
        </p>
        {status ? (
          <p className={cn("mt-0.5 text-[12px] font-medium", statusColor)}>
            {status}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {trend ? <TrendBadge direction={trend} /> : null}
        <p className="text-[16px] font-semibold tabular-nums text-foreground">
          {value}
        </p>
        <ChevronRight className="size-4 text-muted-foreground/50" />
      </div>
    </Link>
  )
}
