"use client"

import { motion } from "framer-motion"
import Link from "next/link"

import { SectionLabel } from "@/components/ui/section-label"
import type { TrendCard } from "@/lib/health/progress"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function TrendCards({ cards }: { cards: TrendCard[] }) {
  return (
    <section className="space-y-5">
      <div>
        <SectionLabel>Trends</SectionLabel>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Latest reading, change over the selected range, and direction.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card, index) => {
          const body = (
            <motion.article
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transitions.fadeUp, delay: index * 0.02 }}
              className="space-y-3 px-1 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  {card.label}
                </p>
                {card.statusLabel ? (
                  <span className="text-[11px] text-muted-foreground/80">
                    {card.statusLabel}
                  </span>
                ) : null}
              </div>

              {card.available ? (
                <>
                  <p className="text-[28px] leading-none font-medium tracking-tight text-foreground">
                    {card.latestDisplay ?? "—"}
                  </p>
                  <div className="flex items-end justify-between gap-3">
                    <div className="space-y-1">
                      <p
                        className={cn(
                          "text-[14px] font-medium",
                          card.improving === true && "text-success",
                          card.improving === false && "text-warning",
                          card.improving == null && "text-muted-foreground"
                        )}
                      >
                        {card.changeDisplay ?? "—"}
                        {card.percentChangeDisplay
                          ? ` · ${card.percentChangeDisplay}`
                          : ""}
                      </p>
                      <p className="text-[12px] text-muted-foreground">
                        {card.changeDirection === "up"
                          ? "Rising"
                          : card.changeDirection === "down"
                            ? "Falling"
                            : "Stable"}
                        {card.improving === true
                          ? " · improving"
                          : card.improving === false
                            ? " · watch"
                            : ""}
                      </p>
                    </div>
                    <Sparkline values={card.sparkline} />
                  </div>
                </>
              ) : (
                <p className="text-[14px] leading-relaxed text-muted-foreground">
                  {card.emptyHint ?? "Unavailable"}
                </p>
              )}
            </motion.article>
          )

          if (card.href) {
            return (
              <Link
                key={card.id}
                href={card.href}
                className="rounded-xl outline-none transition-colors hover:bg-card/30 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {body}
              </Link>
            )
          }
          return <div key={card.id}>{body}</div>
        })}
      </div>
    </section>
  )
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <div className="h-8 w-20" />
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const width = 80
  const height = 32
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width
      const y = height - ((value - min) / span) * (height - 4) - 2
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 text-primary"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}
