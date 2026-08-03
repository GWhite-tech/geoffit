"use client"

import { format } from "date-fns"
import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import { cn } from "@/lib/utils"
import { transitions } from "@/lib/theme"

export interface MorningBriefProps {
  name: string
  greeting?: string
  body: string
  className?: string
}

export function MorningBrief({
  name,
  greeting = "Good morning",
  body,
  className,
}: MorningBriefProps) {
  const today = format(new Date(), "EEEE, d MMMM yyyy")

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitions.fadeUp}
      className={cn("surface-soft max-w-[44rem] py-2 lg:py-3", className)}
    >
      <SectionLabel>Morning Brief</SectionLabel>
      <h1 className="mt-5 font-sans text-[2.5rem] font-semibold tracking-[-0.02em] text-foreground lg:text-[2.75rem] lg:leading-[1.1]">
        {greeting}, {name}.
      </h1>
      <p className="mt-2 text-[13px] text-muted-foreground">{today}</p>
      <p className="mt-8 text-[18px] leading-[1.85] text-foreground/85">
        {body}
      </p>
    </motion.section>
  )
}
