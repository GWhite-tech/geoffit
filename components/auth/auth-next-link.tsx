"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import type { ReactNode } from "react"

import { authHrefWithNext } from "@/lib/auth/safe-next"

export function AuthNextLink({
  href,
  className,
  children,
}: {
  href: "/login" | "/register"
  className?: string
  children: ReactNode
}) {
  const searchParams = useSearchParams()
  const to = authHrefWithNext(href, searchParams.get("next"))
  return (
    <Link href={to} className={className}>
      {children}
    </Link>
  )
}
