"use client"

import { Input } from "@/components/ui/input"
import type { PreferenceDefinition, PreferenceValue } from "@/lib/settings"
import { usePreferenceValue, useSettingsAction } from "@/lib/settings"
import { cn } from "@/lib/utils"

export function PreferenceField({
  preference,
}: {
  preference: PreferenceDefinition
}) {
  const { value, setValue } = usePreferenceValue(preference.id)
  const runAction = useSettingsAction()
  const comingSoon = preference.availability === "coming_soon"

  return (
    <div
      className={cn(
        "grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(180px,240px)] sm:items-center",
        comingSoon && "opacity-60"
      )}
    >
      <div className="min-w-0">
        <p className="text-[15px] font-medium tracking-tight text-foreground">
          {preference.label}
        </p>
        {preference.description ? (
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {preference.description}
          </p>
        ) : null}
        {comingSoon ? (
          <p className="mt-1 text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
            Coming soon
          </p>
        ) : null}
      </div>

      <div className="sm:justify-self-end">
        <Control
          preference={preference}
          value={value}
          disabled={comingSoon && preference.control !== "action"}
          onChange={setValue}
          onAction={() => runAction(preference.actionId ?? preference.id)}
        />
      </div>
    </div>
  )
}

function Control({
  preference,
  value,
  disabled,
  onChange,
  onAction,
}: {
  preference: PreferenceDefinition
  value: PreferenceValue
  disabled?: boolean
  onChange: (value: PreferenceValue) => void
  onAction: () => void
}) {
  switch (preference.control) {
    case "toggle": {
      const on = Boolean(value)
      return (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(!on)}
          className={cn(
            "relative h-7 w-12 rounded-full transition-colors",
            on ? "bg-primary" : "bg-border/80"
          )}
          aria-pressed={on}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 size-6 rounded-full bg-background transition-transform",
              on && "translate-x-5"
            )}
          />
        </button>
      )
    }
    case "select":
      return (
        <select
          disabled={disabled}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full min-w-[180px] rounded-xl border border-border/40 bg-card/30 px-3 text-[13px] text-foreground outline-none"
        >
          {(preference.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )
    case "number":
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            disabled={disabled}
            inputMode="decimal"
            min={preference.min}
            max={preference.max}
            step={preference.step ?? "any"}
            value={value == null ? "" : String(value)}
            onChange={(event) => {
              const next = event.target.value
              if (next === "") {
                onChange(null)
                return
              }
              const parsed = Number(next)
              if (Number.isFinite(parsed)) onChange(parsed)
            }}
            className="h-10 w-[120px] border-border/40 bg-card/30 text-right"
          />
          {preference.unit ? (
            <span className="text-[12px] text-muted-foreground">
              {preference.unit}
            </span>
          ) : null}
        </div>
      )
    case "date":
      return (
        <Input
          type="date"
          disabled={disabled}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-[180px] border-border/40 bg-card/30"
        />
      )
    case "email":
    case "text":
      return (
        <Input
          type={preference.control === "email" ? "email" : "text"}
          disabled={disabled}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full min-w-[180px] border-border/40 bg-card/30"
        />
      )
    case "textarea":
      return (
        <textarea
          disabled={disabled}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          className="w-full min-w-[180px] resize-none rounded-xl border border-border/40 bg-card/30 px-3 py-2 text-[13px] text-foreground outline-none"
        />
      )
    case "action":
      return (
        <button
          type="button"
          onClick={onAction}
          className="rounded-full border border-border/50 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {preference.availability === "coming_soon" ? "Soon" : "Open"}
        </button>
      )
    case "readonly":
      return (
        <p className="text-[13px] text-muted-foreground">
          {value == null || value === "" ? "—" : String(value)}
        </p>
      )
    default:
      return null
  }
}
