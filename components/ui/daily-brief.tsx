"use client"

import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import { transitions } from "@/lib/theme"

import type { DailyBriefProps } from "./daily-brief.types"

export type {
  DailyBriefNutrition,
  DailyBriefProps,
  DailyBriefSleep,
  DailyBriefWeight,
} from "./daily-brief.types"

const weightVerbs = {
  down: "down",
  up: "up",
  unchanged: "unchanged",
} as const

function InsightParagraph({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        "text-[17px] leading-[1.75] text-foreground/85",
        className
      )}
    >
      {children}
    </p>
  )
}

export function DailyBrief({
  name,
  greeting = "Good morning",
  sleep,
  weight,
  recovery,
  focus,
  recommendation,
  nutrition,
  className,
}: DailyBriefProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitions.fadeUp}
      className={cn(
        "glass-panel max-w-[480px] rounded-xl px-8 py-9 lg:px-10 lg:py-10",
        className
      )}
    >
      <p className="text-[11px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
        Daily Brief
      </p>

      <h1 className="mt-5 font-sans text-[2.25rem] font-semibold tracking-[-0.02em] text-foreground lg:text-[2.5rem] lg:leading-tight">
        {greeting}, {name}.
      </h1>

      <div className="mt-8 space-y-4">
        {sleep ? (
          <InsightParagraph>
            You slept{" "}
            <span className="font-medium text-foreground">{sleep.duration}</span>
            {" — "}
            {sleep.deltaLabel}.
          </InsightParagraph>
        ) : null}

        {weight ? (
          <InsightParagraph>
            {weight.direction === "unchanged" ? (
              <>
                Weight held steady at{" "}
                <span className="font-medium text-foreground">{weight.amount}</span>.
              </>
            ) : (
              <>
                Weight is {weightVerbs[weight.direction]}{" "}
                <span className="font-medium text-foreground">{weight.amount}</span>.
              </>
            )}
          </InsightParagraph>
        ) : null}

        {recovery !== undefined ? (
          <InsightParagraph>
            Recovery is{" "}
            <span className="font-medium text-foreground">{recovery}%</span>.
          </InsightParagraph>
        ) : null}

        <InsightParagraph>
          Today&apos;s focus is{" "}
          <span className="font-medium text-foreground">{focus}</span>.
        </InsightParagraph>
      </div>

      <div className="mt-10">
        <p className="text-[11px] font-medium tracking-[0.2em] text-primary uppercase">
          Recommendation
        </p>
        <p className="mt-3 text-[17px] leading-[1.75] text-foreground">
          {recommendation}
        </p>
      </div>

      {nutrition ? (
        <InsightParagraph className="mt-8">
          {nutrition.label} has averaged{" "}
          <span className="font-medium text-foreground">{nutrition.average}</span>
          {nutrition.period ? ` ${nutrition.period}` : null}.
        </InsightParagraph>
      ) : null}
    </motion.article>
  )
}
