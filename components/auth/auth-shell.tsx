"use client"

import Link from "next/link"

import { cn } from "@/lib/utils"

export function AuthShell({
  children,
  title,
  subtitle,
  footer,
  className,
}: {
  children: React.ReactNode
  title: string
  subtitle?: string
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,color-mix(in_srgb,var(--primary)_18%,transparent),transparent_70%)]"
      />
      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-10 text-center">
          <Link
            href="/login"
            className="text-[13px] font-semibold tracking-[0.22em] text-primary uppercase"
          >
            Geoffit
          </Link>
          <h1 className="mt-5 text-[2rem] font-semibold tracking-[-0.03em] text-foreground">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div
          className={cn(
            "rounded-2xl border border-border/50 bg-card/40 p-6 shadow-[var(--shadow-card)] backdrop-blur-md sm:p-8",
            className
          )}
        >
          {children}
        </div>

        {footer ? (
          <div className="mt-8 text-center text-[14px] text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
