"use client"

import { motion } from "framer-motion"

import {
  DATA_SOURCES,
  type DataSourceDefinition,
  type DataSourceId,
} from "@/lib/importers/sources"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

interface ImportSourcePickerProps {
  selectedId: DataSourceId | null
  onSelect: (source: DataSourceDefinition) => void
}

export function ImportSourcePicker({
  selectedId,
  onSelect,
}: ImportSourcePickerProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Step 1 · Choose source
        </p>
        <p className="mt-2 text-[15px] text-foreground/80">
          Pick where this data comes from. Geoffit will only accept the matching
          file types.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {DATA_SOURCES.map((source, index) => {
          const Icon = source.icon
          const selected = selectedId === source.id
          return (
            <motion.button
              key={source.id}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transitions.fadeUp, delay: index * 0.04 }}
              onClick={() => onSelect(source)}
              className={cn(
                "surface-functional flex items-start gap-4 rounded-xl border px-5 py-4 text-left transition-colors",
                selected
                  ? "border-primary/50 bg-primary/[0.06]"
                  : "border-border/50 hover:border-border hover:bg-muted/20",
                !source.available && "opacity-70"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg",
                  selected ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground"
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[15px] font-medium text-foreground">
                    {source.label}
                  </span>
                  {!source.available ? (
                    <span className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                      Soon
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">
                  {source.description}
                </span>
                {source.acceptedExtensions.length > 0 ? (
                  <span className="mt-2 block font-mono text-[12px] text-muted-foreground/80">
                    {source.acceptedExtensions.join(" · ")}
                  </span>
                ) : null}
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
