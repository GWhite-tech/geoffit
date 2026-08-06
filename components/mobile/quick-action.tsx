import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export function QuickAction({
  href,
  label,
  icon: Icon,
  onClick,
  className,
}: {
  href?: string
  label: string
  icon: LucideIcon
  onClick?: () => void
  className?: string
}) {
  const classNames = cn(
    "inline-flex min-h-11 items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2.5 text-[14px] font-medium text-foreground ring-1 ring-white/[0.06] transition-colors active:bg-white/[0.1]",
    className
  )

  if (href) {
    return (
      <Link href={href} className={classNames}>
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={classNames}>
      <Icon className="size-4 text-muted-foreground" />
      {label}
    </button>
  )
}
