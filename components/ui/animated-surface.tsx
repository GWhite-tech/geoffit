"use client"

import { motion, type HTMLMotionProps } from "framer-motion"

import { cn } from "@/lib/utils"
import { transitions } from "@/lib/theme"

interface AnimatedSurfaceProps extends HTMLMotionProps<"div"> {
  interactive?: boolean
}

export function AnimatedSurface({
  className,
  interactive = true,
  children,
  ...props
}: AnimatedSurfaceProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitions.fadeUp}
      whileHover={interactive ? { y: -2 } : undefined}
      className={cn(
        "rounded-2xl border border-border bg-card p-6",
        "shadow-[var(--shadow-card)] transition-shadow duration-[250ms]",
        interactive && "hover:shadow-[var(--shadow-card-hover)]",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
}
