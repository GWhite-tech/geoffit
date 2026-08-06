"use client"

import Link from "next/link"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export function MobileHeader({
  title,
  className,
}: {
  title?: string
  className?: string
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-border/40 bg-background/90 px-4 backdrop-blur md:hidden",
        className
      )}
    >
      <SidebarTrigger className="text-muted-foreground" />
      <Link
        href="/mission-control"
        className="text-[13px] font-semibold tracking-tight text-foreground"
      >
        {title ?? "Geoffit"}
      </Link>
    </header>
  )
}
