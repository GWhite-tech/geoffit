"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import { cn } from "@/lib/utils"
import { transitions } from "@/lib/theme"

import type { TimelineEvent } from "@/lib/mission-control-data"

interface ActivityTimelineProps {
  events: TimelineEvent[]
  className?: string
}

function groupEvents(events: TimelineEvent[]) {
  return events.reduce<{ dateLabel: string; items: TimelineEvent[] }[]>(
    (groups, event) => {
      const last = groups[groups.length - 1]
      if (last?.dateLabel === event.dateLabel) {
        last.items.push(event)
      } else {
        groups.push({ dateLabel: event.dateLabel, items: [event] })
      }
      return groups
    },
    []
  )
}

export function ActivityTimeline({ events, className }: ActivityTimelineProps) {
  const groups = groupEvents(events)

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transitions.fadeUp, delay: 0.18 }}
      className={cn("surface-functional p-8 lg:p-9", className)}
    >
      <SectionLabel>Timeline</SectionLabel>

      <div className="mt-7 space-y-8">
        {groups.map((group) => (
          <div key={group.dateLabel}>
            <p className="mb-4 text-[13px] font-medium tracking-wide text-muted-foreground/70">
              {group.dateLabel}
            </p>
            <ul className="space-y-5">
              {group.items.map((event) => (
                <li
                  key={event.id}
                  className="flex items-start justify-between gap-6 border-l border-border/30 pl-4"
                >
                  <p className="text-[15px] leading-relaxed text-foreground/90">
                    {event.title}
                    {event.detail ? (
                      <span className="text-muted-foreground/80"> · {event.detail}</span>
                    ) : null}
                  </p>
                  <span className="shrink-0 pt-0.5 text-[12px] text-muted-foreground/50 tabular-nums">
                    {event.time}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </motion.section>
  )
}
