"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

import { SectionLabel } from "@/components/ui/section-label"
import { useTodaySummary } from "@/lib/health/treatment"
import { transitions } from "@/lib/theme"

export function TreatmentAlertsSection() {
  const { reminders, next, todays } = useTodaySummary()
  const done = todays.filter((item) => item.done).length
  const total = todays.length

  if (total === 0 && reminders.length === 0) return null

  return (
    <section className="space-y-6">
      <div>
        <SectionLabel>Treatments</SectionLabel>
        <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
          Today’s doses and supply signals.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transitions.fadeUp, delay: 0.04 }}
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        <div className="mc-card px-6 py-6">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/65 uppercase">
            Today
          </p>
          <p className="mt-4 text-[28px] leading-none font-medium tracking-tight text-foreground">
            {done}/{total}
          </p>
          <p className="mt-3 text-[13px] text-muted-foreground">
            treatments logged
          </p>
        </div>

        <div className="mc-card px-6 py-6">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/65 uppercase">
            Next due
          </p>
          <p className="mt-4 text-[22px] leading-none font-medium tracking-tight text-foreground">
            {next?.treatment.shortName ?? "All clear"}
          </p>
          <p className="mt-3 text-[13px] text-muted-foreground">
            {next ? next.time : "Nothing remaining today"}
          </p>
        </div>

        <div className="mc-card px-6 py-6">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/65 uppercase">
            Supply
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-foreground">
            {reminders[0]?.detail ?? "No alerts"}
          </p>
          <p className="mt-3 text-[13px] text-muted-foreground">
            {reminders[0]?.title ?? "Inventory looks healthy"}
          </p>
        </div>
      </motion.div>

      <div className="pt-1">
        <Link
          href="/treatment"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary transition-colors hover:text-primary-hover"
        >
          Open weekly planner
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  )
}
