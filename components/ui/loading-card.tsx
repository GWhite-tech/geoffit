"use client"

import { AnimatedSurface } from "@/components/ui/animated-surface"
import { Skeleton } from "@/components/ui/skeleton"

interface LoadingCardProps {
  lines?: number
  showIcon?: boolean
  showSparkline?: boolean
  className?: string
}

export function LoadingCard({
  lines = 2,
  showIcon = true,
  showSparkline = false,
  className,
}: LoadingCardProps) {
  return (
    <AnimatedSurface interactive={false} className={className}>
      <div className="flex items-start justify-between gap-4">
        {showIcon ? <Skeleton className="size-10 rounded-xl" /> : <div />}
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-32" />
          {Array.from({ length: lines }).map((_, index) => (
            <Skeleton key={index} className="h-3 w-full max-w-48" />
          ))}
        </div>
        {showSparkline ? <Skeleton className="h-7 w-[4.5rem] rounded-md" /> : null}
      </div>
    </AnimatedSurface>
  )
}
