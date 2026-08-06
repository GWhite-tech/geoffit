import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { Plus } from "lucide-react"

import { cn } from "@/lib/utils"

export function FloatingActionButton({
  href,
  label,
  icon: Icon = Plus,
  onClick,
  className,
}: {
  href?: string
  label: string
  icon?: LucideIcon
  onClick?: () => void
  className?: string
}) {
  const classNames = cn(
    "fixed right-4 z-30 flex size-14 items-center justify-center rounded-full bg-foreground text-background shadow-[0_12px_32px_-8px_rgb(0_0_0_/_0.55)] transition-transform active:scale-95 md:hidden",
    "bottom-[calc(4.25rem+env(safe-area-inset-bottom))]",
    className
  )

  if (href) {
    return (
      <Link href={href} aria-label={label} className={classNames}>
        <Icon className="size-6" />
      </Link>
    )
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={classNames}
    >
      <Icon className="size-6" />
    </button>
  )
}
