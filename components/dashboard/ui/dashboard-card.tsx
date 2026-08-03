"use client"

import { motion, type HTMLMotionProps } from "framer-motion"

import { cn } from "@/lib/utils"

interface DashboardCardProps extends HTMLMotionProps<"div"> {
  accent?: "violet" | "blue" | "amber" | "none"
  glass?: boolean
}

const accentStyles = {
  violet: "hover:ring-[#7C3AED]/25",
  blue: "hover:ring-sky-500/20",
  amber: "hover:ring-amber-500/20",
  none: "hover:ring-foreground/10",
}

export function DashboardCard({
  className,
  accent = "none",
  glass = false,
  children,
  ...props
}: DashboardCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        "group relative overflow-hidden rounded-2xl p-6",
        "ring-1 ring-foreground/[0.06]",
        "transition-shadow duration-300",
        "hover:shadow-xl hover:shadow-black/25",
        glass
          ? "glass-panel"
          : "bg-card/70",
        accentStyles[accent],
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
}
