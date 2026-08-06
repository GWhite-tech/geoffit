import { cn } from "@/lib/utils"

export function AdaptiveGrid({
  children,
  className,
  cols = 2,
}: {
  children: React.ReactNode
  className?: string
  cols?: 1 | 2 | 3 | 4
}) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:gap-5",
        cols === 1 && "grid-cols-1",
        cols === 2 && "grid-cols-1 sm:grid-cols-2",
        cols === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        cols === 4 && "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  )
}
