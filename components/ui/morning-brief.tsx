"use client"

import { format } from "date-fns"
import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import { cn } from "@/lib/utils"
import { transitions } from "@/lib/theme"

export interface MorningBriefProps {
  name: string
  greeting?: string
  body?: string
  lines?: string[]
  className?: string
}

export function MorningBrief({
  name,
  greeting = "Good morning",
  body,
  lines,
  className,
}: MorningBriefProps) {
  const today = format(new Date(), "EEEE, d MMMM yyyy")
  const paragraphs =
    lines && lines.length > 0 ? lines : body ? [body] : ([] as string[])

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitions.fadeUp}
      className={cn("max-w-[40rem]", className)}
    >
      <SectionLabel className="text-[11px] tracking-[0.2em] text-muted-foreground/70">
        Morning Brief
      </SectionLabel>
      <h1 className="mt-5 font-sans text-[40px] leading-[1.08] font-semibold tracking-[-0.03em] text-foreground sm:text-[44px]">
        {greeting}, {name}.
      </h1>
      <p className="mt-3 text-[13px] text-muted-foreground">{today}</p>
      <div className="mt-8 space-y-3">
        {paragraphs.map((line) => (
          <p
            key={line}
            className="text-[17px] leading-[1.85] text-foreground/80 sm:text-[18px]"
          >
            {line}
          </p>
        ))}
      </div>
    </motion.section>
  )
}
