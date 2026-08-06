"use client"

import { cn } from "@/lib/utils"

export function SettingsSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="text-[13px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
        {title}
      </h3>
      <div className="mt-2 divide-y divide-border/25">{children}</div>
    </section>
  )
}

export function SettingsRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-3 py-4 sm:grid-cols-[1fr_240px] sm:items-center sm:gap-6">
      <div>
        <p className="text-[14px] text-foreground">{label}</p>
        {description ? (
          <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="sm:justify-self-end">{children}</div>
    </div>
  )
}

export function ChoiceRow({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
            value === option.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border/50 bg-card/30 text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
