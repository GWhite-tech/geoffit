"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  Droplets,
  LayoutDashboard,
  TrendingUp,
  UserRound,
} from "lucide-react"

import { cn } from "@/lib/utils"

const ITEMS = [
  {
    href: "/mission-control",
    label: "Mission",
    ariaLabel: "Mission Control",
    icon: LayoutDashboard,
  },
  {
    href: "/progress",
    label: "Progress",
    ariaLabel: "Progress",
    icon: TrendingUp,
  },
  {
    href: "/blood",
    label: "Blood",
    ariaLabel: "Blood",
    icon: Droplets,
  },
  {
    href: "/training",
    label: "Training",
    ariaLabel: "Training",
    icon: Activity,
  },
  {
    href: "/account",
    label: "Account",
    ariaLabel: "Account",
    icon: UserRound,
  },
] as const

function isActive(pathname: string, href: string): boolean {
  if (href === "/mission-control") {
    return pathname === "/" || pathname === "/mission-control"
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function BottomNavigation({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-[#0A0A0C]/92 backdrop-blur-xl md:hidden",
        "pb-[max(0.5rem,env(safe-area-inset-bottom))]",
        className
      )}
      aria-label="Primary"
    >
      <ul className="mx-auto flex h-14 max-w-[390px] items-stretch justify-between px-1">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-label={item.ariaLabel}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full min-h-11 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium tracking-wide transition-colors duration-200",
                  active ? "text-foreground" : "text-muted-foreground/65"
                )}
              >
                <item.icon
                  className={cn(
                    "size-[22px] transition-transform duration-200",
                    active && "scale-105"
                  )}
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span className={cn(active && "text-foreground")}>
                  {item.label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
