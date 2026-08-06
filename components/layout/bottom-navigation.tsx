"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Dumbbell,
  LayoutDashboard,
  Settings,
  TrendingUp,
  Utensils,
} from "lucide-react"

import { cn } from "@/lib/utils"

const ITEMS = [
  { href: "/mission-control", label: "Home", icon: LayoutDashboard },
  { href: "/training", label: "Train", icon: Dumbbell },
  { href: "/nutrition", label: "Fuel", icon: Utensils },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: Settings },
] as const

export function BottomNavigation({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border/50 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden",
        className
      )}
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href === "/mission-control" && pathname === "/") ||
            (item.href !== "/mission-control" &&
              pathname.startsWith(`${item.href}/`))
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 py-2.5 text-[10px] tracking-wide",
                  active
                    ? "font-medium text-primary"
                    : "text-muted-foreground/70"
                )}
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
