"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

const STORAGE_KEY = "geoffit.tab-scroll"
const TAB_PREFIXES = [
  "/mission-control",
  "/progress",
  "/blood",
  "/training",
  "/account",
  "/",
] as const

function isTabRoute(pathname: string): boolean {
  if (pathname === "/") return true
  return TAB_PREFIXES.some(
    (prefix) =>
      prefix !== "/" &&
      (pathname === prefix || pathname.startsWith(`${prefix}/`))
  )
}

function storageKeyFor(pathname: string): string {
  if (pathname === "/" || pathname === "/mission-control") {
    return "/mission-control"
  }
  const root = TAB_PREFIXES.find(
    (prefix) =>
      prefix !== "/" &&
      (pathname === prefix || pathname.startsWith(`${prefix}/`))
  )
  return root ?? pathname
}

function readMap(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, number>)
      : {}
  } catch {
    return {}
  }
}

function writeMap(map: Record<string, number>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore quota / private mode.
  }
}

/**
 * Persist scroll position per primary tab so revisiting a tab feels native.
 */
export function useTabScrollRestoration(scrollParent?: HTMLElement | null) {
  const pathname = usePathname()

  useEffect(() => {
    if (!isTabRoute(pathname)) return

    const key = storageKeyFor(pathname)
    const target = scrollParent ?? document.scrollingElement
    if (!target) return

    const map = readMap()
    const saved = map[key]
    if (typeof saved === "number" && Number.isFinite(saved)) {
      requestAnimationFrame(() => {
        if (target === document.scrollingElement || target === document.documentElement) {
          window.scrollTo(0, saved)
        } else {
          ;(target as HTMLElement).scrollTop = saved
        }
      })
    }

    const persist = () => {
      const next = readMap()
      const top =
        "scrollTop" in target
          ? (target as HTMLElement).scrollTop
          : window.scrollY
      next[key] = top
      writeMap(next)
    }

    const el = scrollParent ?? window
    el.addEventListener("scroll", persist, { passive: true })
    return () => {
      persist()
      el.removeEventListener("scroll", persist)
    }
  }, [pathname, scrollParent])
}
