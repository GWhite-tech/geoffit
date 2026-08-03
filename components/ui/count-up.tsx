"use client"

import { useEffect, useRef, useState } from "react"
import { useInView, useMotionValue, useSpring } from "framer-motion"

interface CountUpProps {
  value: number
  decimals?: number
  suffix?: string
  className?: string
}

export function CountUp({
  value,
  decimals = 0,
  suffix = "",
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-40px" })
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { stiffness: 90, damping: 22 })
  const [display, setDisplay] = useState("0")

  useEffect(() => {
    if (inView) {
      motionValue.set(value)
    }
  }, [inView, motionValue, value])

  useEffect(() => {
    return spring.on("change", (latest) => {
      setDisplay(latest.toFixed(decimals))
    })
  }, [spring, decimals])

  return (
    <span ref={ref} className={className}>
      {display}
      {suffix}
    </span>
  )
}
