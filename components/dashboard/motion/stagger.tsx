"use client"

import { motion, type HTMLMotionProps } from "framer-motion"

const ease = [0.25, 0.1, 0.25, 1] as const

export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.08 },
  },
}

export const fadeUpItem = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease },
  },
}

export function Stagger({
  className,
  children,
  ...props
}: HTMLMotionProps<"div">) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function FadeUp({
  className,
  children,
  ...props
}: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={fadeUpItem} className={className} {...props}>
      {children}
    </motion.div>
  )
}
