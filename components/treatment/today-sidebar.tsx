"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import { useTodaySummary } from "@/lib/health/treatment"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number)
  if (h == null || m == null) return time
  const hour = h % 12 || 12
  const suffix = h >= 12 ? "PM" : "AM"
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`
}

export function TodaySidebar() {
  const { todays, next, reminders } = useTodaySummary()

  return (
    <aside className="flex h-full w-full flex-col border-l border-border/30 px-5 pt-8 pb-8">
      <SectionLabel>Today&apos;s treatments</SectionLabel>
      <ul className="mt-5 space-y-2">
        {todays.length === 0 ? (
          <li className="text-[13px] text-muted-foreground">Nothing scheduled.</li>
        ) : (
          todays.map((item, index) => (
            <motion.li
              key={item.treatment.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transitions.fadeUp, delay: index * 0.03 }}
              className="flex items-center gap-3 text-[14px]"
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[11px]",
                  item.done
                    ? "bg-primary/20 text-primary"
                    : "border border-border/50 text-muted-foreground/50"
                )}
              >
                {item.done ? "✓" : ""}
              </span>
              <span
                className={cn(
                  item.done ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {item.treatment.shortName}
              </span>
            </motion.li>
          ))
        )}
      </ul>

      <div className="mt-8">
        <SectionLabel>Next due</SectionLabel>
        {next ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transitions.fadeUp, delay: 0.06 }}
            className="mc-card mt-4 px-4 py-4"
          >
            <p className="text-[16px] font-medium tracking-tight text-foreground">
              {next.treatment.shortName}
            </p>
            <p className="mt-2 text-[13px] text-muted-foreground">
              {formatTime(next.time)}
            </p>
          </motion.div>
        ) : (
          <p className="mt-4 text-[13px] text-muted-foreground">
            All treatments complete for today.
          </p>
        )}
      </div>

      <div className="mt-8">
        <SectionLabel>Supply alerts</SectionLabel>
        <ul className="mt-4 space-y-2.5">
          {reminders.length === 0 ? (
            <li className="text-[13px] text-muted-foreground">
              No alerts right now.
            </li>
          ) : (
            reminders.map((reminder, index) => (
              <motion.li
                key={reminder.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...transitions.fadeUp, delay: 0.08 + index * 0.03 }}
                className="mc-card px-4 py-3.5"
              >
                <p className="text-[13px] font-medium text-foreground">
                  {reminder.title}
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                  {reminder.detail}
                </p>
              </motion.li>
            ))
          )}
        </ul>
      </div>
    </aside>
  )
}
