"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import { cn } from "@/lib/utils"
import { transitions } from "@/lib/theme"

import type { ProtocolItem } from "@/lib/mission-control-data"

interface TodaysFocusProps {
  workout: {
    title: string
    time: string
    duration: string
    primaryLift: string
    coach: string
  }
  protocol: ProtocolItem[]
  className?: string
}

function ProtocolRow({ item }: { item: ProtocolItem }) {
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            item.completed ? "bg-success/70" : "bg-muted-foreground/30"
          )}
        />
        <span
          className={cn(
            "text-[15px]",
            item.completed ? "text-muted-foreground" : "text-foreground/90"
          )}
        >
          {item.label}
        </span>
      </div>
      {item.detail ? (
        <span className="text-[13px] text-muted-foreground">{item.detail}</span>
      ) : null}
    </li>
  )
}

export function TodaysFocus({ workout, protocol, className }: TodaysFocusProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transitions.fadeUp, delay: 0.1 }}
      className={cn("surface-functional-muted h-full p-8 lg:p-9", className)}
    >
      <SectionLabel>Today&apos;s Focus</SectionLabel>

      <div className="mt-7 grid gap-10 lg:grid-cols-2 lg:gap-12">
        <div>
          <p className="text-[13px] text-muted-foreground">Workout</p>
          <p className="mt-2 text-[1.375rem] font-medium tracking-tight text-foreground/90">
            {workout.title}
          </p>
          <p className="mt-3 text-[14px] text-muted-foreground">
            {workout.duration} · {workout.time}
          </p>
          <dl className="mt-7 space-y-4 text-[15px]">
            <div className="flex justify-between gap-6">
              <dt className="text-muted-foreground">Primary lift</dt>
              <dd className="text-foreground/90">{workout.primaryLift}</dd>
            </div>
            <div className="flex justify-between gap-6">
              <dt className="text-muted-foreground">Coach</dt>
              <dd className="text-foreground/90">{workout.coach}</dd>
            </div>
          </dl>
        </div>

        <div>
          <p className="text-[13px] text-muted-foreground">Protocol</p>
          <ul className="mt-4">
            {protocol.map((item) => (
              <ProtocolRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
      </div>
    </motion.section>
  )
}
