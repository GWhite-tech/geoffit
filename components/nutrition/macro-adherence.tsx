"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import type { MacroAdherenceCard } from "@/lib/health/nutrition"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

function formatValue(card: MacroAdherenceCard, value: number | null): string {
  if (value == null) return "—"
  if (card.unit === "kcal") return Math.round(value).toLocaleString("en-GB")
  if (card.unit === "L") return value.toFixed(1)
  return Math.round(value).toString()
}

export function MacroAdherence({ cards }: { cards: MacroAdherenceCard[] }) {
  return (
    <section className="space-y-4">
      <SectionLabel>Macro adherence</SectionLabel>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((card, index) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transitions.fadeUp, delay: index * 0.03 }}
            className="mc-card px-5 py-5"
          >
            <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground/70 uppercase">
              {card.label}
            </p>
            <p className="mt-3 text-[24px] leading-none font-medium tracking-tight text-foreground">
              {formatValue(card, card.average)}
              <span className="ml-1 text-[13px] font-normal text-muted-foreground">
                {card.unit} avg
              </span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
              <span>Latest {formatValue(card, card.latest)}</span>
              <span
                className={cn(
                  card.trend === "up" && "text-foreground/80",
                  card.trend === "down" && "text-foreground/80"
                )}
              >
                {card.trendDisplay}
              </span>
            </div>
            <p className="mt-3 text-[13px] font-medium text-primary">
              {card.achievement != null
                ? `${card.achievement}% of target`
                : "—"}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
