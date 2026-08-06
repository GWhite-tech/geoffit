"use client"

import { format } from "date-fns"
import { motion } from "framer-motion"

import {
  hasUsefulBrief,
  selectBriefSentences,
} from "@/lib/mission-control/presentation"
import type { MissionControlViewModel } from "@/lib/mission-control/view-model"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function DailyBriefHeader({
  dailyBrief,
  className,
  /** Full VM so we can hide the section when there is nothing useful to say. */
  vm,
}: {
  dailyBrief: MissionControlViewModel["dailyBrief"]
  vm: MissionControlViewModel
  className?: string
}) {
  if (!hasUsefulBrief(vm)) return null

  const sentences = selectBriefSentences(vm)
  const today = format(new Date(), "EEEE, d MMMM")

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitions.fadeUp}
      className={cn("max-w-[36rem]", className)}
    >
      <p className="text-[12px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
        Today’s Brief
      </p>
      <h1 className="mt-3 text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] text-foreground sm:text-[40px]">
        {dailyBrief.title}
      </h1>
      <p className="mt-2 text-[13px] text-muted-foreground">{today}</p>
      {sentences.length > 0 ? (
        <div className="mt-5 space-y-2.5">
          {sentences.map((line) => (
            <p
              key={line}
              className="text-[17px] leading-relaxed text-foreground/85"
            >
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </motion.section>
  )
}
