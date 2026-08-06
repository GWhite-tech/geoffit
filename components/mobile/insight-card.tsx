import { cn } from "@/lib/utils"

export function InsightCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white/[0.03] px-4 py-4 text-[15px] leading-relaxed text-muted-foreground ring-1 ring-white/[0.05]",
        className
      )}
    >
      {children}
    </div>
  )
}
