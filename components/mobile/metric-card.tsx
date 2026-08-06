"use client"

import Link from "next/link"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

export function MetricCard({
  label,
  value,
  unit,
  hint,
  href,
  className,
}: {
  label: string
  value: string
  unit?: string | null
  hint?: string | null
  href?: string
  className?: string
}) {
  const body = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        "flex min-h-[88px] flex-col justify-between rounded-2xl bg-card/50 px-3.5 py-3 ring-1 ring-border/40",
        href && "transition-colors active:bg-card/80",
        className
      )}
    >
      <p className="text-[12px] font-medium tracking-wide text-muted-foreground">
        {label}
      </p>
      <div>
        <p className="text-[22px] font-semibold tracking-tight text-foreground tabular-nums">
          {value}
          {unit ? (
            <span className="ml-1 text-[13px] font-normal text-muted-foreground">
              {unit}
            </span>
          ) : null}
        </p>
        {hint ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">{hint}</p>
        ) : null}
      </div>
    </motion.div>
  )

  if (href) {
    return (
      <Link href={href} className="block min-h-11">
        {body}
      </Link>
    )
  }
  return body
}
