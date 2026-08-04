"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { SleepSummary } from "@/lib/health/sleep"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function SleepConsistency({
  calendar,
}: {
  calendar: SleepSummary["consistencyCalendar"]
}) {
  const days = calendar.days

  return (
    <section className="space-y-6">
      <SectionLabel>Consistency</SectionLabel>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transitions.fadeUp, delay: 0.1 }}
        className="rounded-3xl border border-border/40 bg-card/25 px-6 py-8 sm:px-8"
      >
        {days.length === 0 || days.every((day) => day.durationMinutes == null) ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {calendar.emptyHint ??
              "A consistency heatmap appears once multiple nights of sleep are available."}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {days.map((day) => (
                <Tooltip key={day.date}>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        className={cn(
                          "aspect-square rounded-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          day.durationMinutes == null
                            ? "bg-muted/25"
                            : "bg-primary"
                        )}
                        style={
                          day.durationMinutes == null
                            ? undefined
                            : { opacity: 0.18 + day.intensity * 0.82 }
                        }
                        aria-label={
                          day.durationLabel
                            ? `${day.date}: ${day.durationLabel}`
                            : `${day.date}: no sleep`
                        }
                      />
                    }
                  />
                  <TooltipContent className="space-y-1 px-3 py-2 text-left">
                    <p className="font-medium text-background">{day.date}</p>
                    {day.durationLabel ? (
                      <>
                        <p>Bedtime {day.bedtimeLabel ?? "—"}</p>
                        <p>Wake {day.wakeLabel ?? "—"}</p>
                        <p>Duration {day.durationLabel}</p>
                      </>
                    ) : (
                      <p>No sleep recorded</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
              <span>Less</span>
              <div className="flex items-center gap-1">
                {[0.2, 0.4, 0.6, 0.8, 1].map((intensity) => (
                  <span
                    key={intensity}
                    className="size-2.5 rounded-sm bg-primary"
                    style={{ opacity: 0.18 + intensity * 0.82 }}
                  />
                ))}
              </div>
              <span>More</span>
            </div>
          </>
        )}
      </motion.div>
    </section>
  )
}
