"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import { cn } from "@/lib/utils"
import { transitions } from "@/lib/theme"

export interface GoalsModuleProps {
  label: string
  target: number
  unit: string
  remaining: number
  progress: number
  estimatedCompletion: string
  className?: string
}

export function GoalsModule({
  label,
  target,
  unit,
  remaining,
  progress,
  estimatedCompletion,
  className,
}: GoalsModuleProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 1)

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transitions.fadeUp, delay: 0.14 }}
      className={cn("surface-functional p-8 lg:p-9", className)}
    >
      <SectionLabel>Goals</SectionLabel>

      <div className="mt-6 flex items-end justify-between gap-6">
        <div>
          <p className="text-[13px] text-muted-foreground">{label}</p>
          <p className="mt-2 text-[2rem] font-semibold tracking-tight text-foreground tabular-nums">
            {target} {unit}
          </p>
        </div>
        <p className="text-[13px] text-muted-foreground">
          {remaining} {unit} remaining
        </p>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between text-[13px] text-muted-foreground">
          <span>Progress</span>
          <span>{Math.round(clampedProgress * 100)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.06]">
          <motion.div
            className="h-full rounded-full bg-primary/70"
            initial={{ width: 0 }}
            animate={{ width: `${clampedProgress * 100}%` }}
            transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 }}
          />
        </div>
      </div>

      <p className="mt-6 text-[13px] text-muted-foreground">
        Estimated completion{" "}
        <span className="text-foreground/80">{estimatedCompletion}</span>
      </p>
    </motion.section>
  )
}
