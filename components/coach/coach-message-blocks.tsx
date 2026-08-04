"use client"

import Link from "next/link"
import { Line, LineChart, XAxis, YAxis } from "recharts"

import { CoachMarkdown } from "@/components/coach/coach-markdown"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { CoachMessageBlock } from "@/lib/health/coach"
import { cn } from "@/lib/utils"

export function CoachMessageBlocks({
  blocks,
  onAction,
}: {
  blocks: CoachMessageBlock[]
  onAction?: (question: string) => void
}) {
  return (
    <div className="space-y-5">
      {blocks.map((block) => {
        switch (block.type) {
          case "markdown":
            return <CoachMarkdown key={block.id} markdown={block.markdown} />
          case "chart":
            return <ChartBlock key={block.id} block={block} />
          case "metric_card":
            return (
              <div key={block.id}>
                {block.href ? (
                  <Link href={block.href} className="block">
                    <MetricCard block={block} />
                  </Link>
                ) : (
                  <MetricCard block={block} />
                )}
              </div>
            )
          case "blood_card":
            return (
              <div key={block.id}>
                {block.href ? (
                  <Link href={block.href} className="block">
                    <BloodCard block={block} />
                  </Link>
                ) : (
                  <BloodCard block={block} />
                )}
              </div>
            )
          case "table":
            return (
              <div key={block.id} className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-border/40 text-muted-foreground">
                      {block.headers.map((header) => (
                        <th key={header} className="py-2 pr-4 font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, index) => (
                      <tr key={index} className="border-b border-border/20">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="py-2.5 pr-4 text-foreground">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case "evidence":
            return (
              <div key={block.id} className="space-y-2 border-l border-primary/40 pl-4">
                <p className="text-[14px] leading-relaxed text-foreground/90">
                  {block.why}
                </p>
                <p className="text-[12px] tracking-[0.12em] text-muted-foreground uppercase">
                  Confidence · {block.confidence}
                </p>
                <p className="text-[13px] text-muted-foreground">
                  Supporting evidence: {block.supporting.join(" · ")}
                </p>
              </div>
            )
          case "actions":
            return (
              <div key={block.id} className="flex flex-wrap gap-2">
                {block.actions.map((action) =>
                  action.href ? (
                    <Link
                      key={action.id}
                      href={action.href}
                      className="rounded-full border border-border/50 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {action.label}
                    </Link>
                  ) : (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => onAction?.(action.label)}
                      className="rounded-full border border-border/50 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {action.label}
                    </button>
                  )
                )}
              </div>
            )
          case "citations":
            return (
              <div key={block.id} className="space-y-2">
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
                  Sources
                </p>
                <ul className="flex flex-wrap gap-2">
                  {block.citations.map((citation) =>
                    citation.href ? (
                      <li key={citation.id}>
                        <Link
                          href={citation.href}
                          className="text-[12px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          {citation.label}
                          {citation.detail ? ` · ${citation.detail}` : ""}
                        </Link>
                      </li>
                    ) : (
                      <li
                        key={citation.id}
                        className="text-[12px] text-muted-foreground"
                      >
                        {citation.label}
                        {citation.detail ? ` · ${citation.detail}` : ""}
                      </li>
                    )
                  )}
                </ul>
              </div>
            )
          default:
            return null
        }
      })}
    </div>
  )
}

function MetricCard({
  block,
}: {
  block: Extract<CoachMessageBlock, { type: "metric_card" }>
}) {
  return (
    <div className="rounded-2xl border border-border/30 px-4 py-3.5">
      <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
        {block.label}
      </p>
      <p className="mt-2 text-[24px] font-medium tracking-tight text-foreground">
        {block.value}
      </p>
      {block.detail ? (
        <p className="mt-1 text-[12px] text-muted-foreground">{block.detail}</p>
      ) : null}
    </div>
  )
}

function BloodCard({
  block,
}: {
  block: Extract<CoachMessageBlock, { type: "blood_card" }>
}) {
  return (
    <div className="rounded-2xl border border-border/30 px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
          {block.marker}
        </p>
        {block.status ? (
          <span className="text-[11px] text-muted-foreground">{block.status}</span>
        ) : null}
      </div>
      <p className="mt-2 text-[22px] font-medium tracking-tight text-foreground">
        {block.value}
      </p>
      {block.change ? (
        <p className="mt-1 text-[12px] text-muted-foreground">{block.change}</p>
      ) : null}
    </div>
  )
}

function ChartBlock({
  block,
}: {
  block: Extract<CoachMessageBlock, { type: "chart" }>
}) {
  if (block.points.length < 2) return null
  const config: ChartConfig = {
    value: { label: block.title, color: "var(--primary)" },
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] tracking-[0.12em] text-muted-foreground uppercase">
        {block.title}
      </p>
      <ChartContainer
        config={config}
        className="aspect-[2.4/1] min-h-[160px] w-full"
        initialDimension={{ width: 640, height: 200 }}
      >
        <LineChart data={block.points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            domain={["auto", "auto"]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            type="natural"
            dataKey="value"
            stroke="var(--color-value)"
            strokeWidth={2.25}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ChartContainer>
      <p className={cn("text-[12px] text-muted-foreground")}>Unit: {block.unit}</p>
    </div>
  )
}
