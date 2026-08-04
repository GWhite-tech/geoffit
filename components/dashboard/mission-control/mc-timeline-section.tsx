"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  Activity,
  ArrowRight,
  Droplets,
  Dumbbell,
  Heart,
  Moon,
  Pill,
  Ruler,
  Scale,
  Upload,
} from "lucide-react"

import { SectionLabel } from "@/components/ui/section-label"
import type { McTimelineEvent } from "@/lib/health/analytics"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

const KIND_META: Record<
  McTimelineEvent["kind"],
  { icon: typeof Scale; className: string }
> = {
  weight: { icon: Scale, className: "bg-primary/15 text-primary" },
  blood_test: { icon: Droplets, className: "bg-primary/15 text-primary" },
  import: { icon: Upload, className: "bg-primary/15 text-primary" },
  workout: { icon: Dumbbell, className: "bg-warning/15 text-warning" },
  measurement: { icon: Ruler, className: "bg-primary/15 text-primary" },
  medication: { icon: Pill, className: "bg-success/15 text-success" },
  sleep: { icon: Moon, className: "bg-primary/15 text-primary" },
  recovery: { icon: Heart, className: "bg-success/15 text-success" },
}

export function McTimelineSection({ events }: { events: McTimelineEvent[] }) {
  const items = events.slice(0, 12)

  return (
    <section id="timeline" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionLabel>Timeline</SectionLabel>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            A chronological feed of weight, labs, workouts, and imports.
          </p>
        </div>
        <Link
          href="#timeline"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary transition-colors hover:text-primary-hover"
        >
          View full timeline
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transitions.fadeUp, delay: 0.1 }}
        className="mc-card px-2 py-2 sm:px-3 sm:py-3"
      >
        {items.length === 0 ? (
          <p className="px-4 py-6 text-[15px] leading-relaxed text-muted-foreground">
            Import Apple Health or a blood test to start your health timeline.
          </p>
        ) : (
          <ul className="divide-y divide-border/40">
            {items.map((event) => {
              const meta = KIND_META[event.kind] ?? {
                icon: Activity,
                className: "bg-muted text-muted-foreground",
              }
              const Icon = meta.icon
              const timestamp = [event.dateLabel, event.time]
                .filter((part) => part && part !== "—")
                .join(", ")

              return (
                <li
                  key={event.id}
                  className="flex items-center gap-4 px-4 py-4 sm:gap-5 sm:px-5"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl",
                      meta.className
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium tracking-tight text-foreground">
                      {event.title}
                    </p>
                    {event.detail ? (
                      <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                        {event.detail}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[13px] text-muted-foreground/70 tabular-nums">
                    {timestamp || "—"}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </motion.div>

      {items.length > 0 ? (
        <div className="flex justify-center pt-1">
          <Link
            href="#timeline"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary transition-colors hover:text-primary-hover"
          >
            View full timeline
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : null}
    </section>
  )
}
