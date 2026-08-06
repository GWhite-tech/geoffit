import { cn } from "@/lib/utils"

export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-11 items-end justify-between gap-3 px-1",
        className
      )}
    >
      <h2 className="text-[20px] font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
