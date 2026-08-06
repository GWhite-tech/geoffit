import { cn } from "@/lib/utils"

export function ResponsiveCard({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/40 bg-card/40 shadow-[var(--shadow-card)]",
        padded && "p-5 sm:p-6",
        className
      )}
    >
      {children}
    </div>
  )
}
