"use client"

import type { LucideIcon } from "lucide-react"

import { AnimatedSurface } from "@/components/ui/animated-surface"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <AnimatedSurface
      interactive={false}
      className={cn(
        "surface-functional flex flex-col items-center px-6 py-12 text-center",
        className
      )}
    >
      {Icon ? (
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <Icon className="size-5 text-primary" />
        </div>
      ) : null}
      <h3
        className={cn(
          "text-lg font-semibold tracking-tight text-foreground",
          Icon ? "mt-5" : ""
        )}
      >
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </AnimatedSurface>
  )
}
