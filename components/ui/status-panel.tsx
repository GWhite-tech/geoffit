"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import { cn } from "@/lib/utils"
import { transitions } from "@/lib/theme"

import type { StatusModuleData } from "@/lib/mission-control-data"

interface StatusModuleProps {
  label: string
  status: string
  attention: StatusModuleData["attention"]
}

const dotStyles: Record<StatusModuleData["attention"], string> = {
  clear: "bg-success/70",
  good: "bg-muted-foreground/35",
  attention: "bg-warning/60",
}

const statusStyles: Record<StatusModuleData["attention"], string> = {
  clear: "text-foreground/90",
  good: "text-foreground/85",
  attention: "text-warning/80",
}

function StatusModule({ label, status, attention }: StatusModuleProps) {
  return (
    <div className="min-w-0 rounded-lg px-1 py-2">
      <div className="flex items-center gap-2.5">
        <span className={cn("size-1.5 shrink-0 rounded-full", dotStyles[attention])} />
        <p className="truncate text-[13px] text-muted-foreground">{label}</p>
      </div>
      <p className={cn("mt-2 truncate text-[15px]", statusStyles[attention])}>
        {status}
      </p>
    </div>
  )
}

interface StatusPanelProps {
  modules: StatusModuleData[]
  className?: string
}

export function StatusPanel({ modules, className }: StatusPanelProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transitions.fadeUp, delay: 0.16 }}
      className={cn("surface-functional p-8 lg:p-9", className)}
    >
      <SectionLabel>Health Status</SectionLabel>
      <div className="mt-7 grid grid-cols-2 gap-x-8 gap-y-7 sm:grid-cols-3">
        {modules.map((module) => (
          <StatusModule key={module.id} {...module} />
        ))}
      </div>
    </motion.section>
  )
}
