import { cn } from "@/lib/utils"

export function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-[12px] font-medium tracking-[0.08em] text-muted-foreground uppercase"
    >
      {children}
    </label>
  )
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null
  return <p className="mt-1.5 text-[13px] text-destructive">{children}</p>
}

export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive"
    >
      {children}
    </div>
  )
}

export function FormSuccess({ children }: { children?: React.ReactNode }) {
  if (!children) return null
  return (
    <div
      role="status"
      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-[13px] text-emerald-700 dark:text-emerald-300"
    >
      {children}
    </div>
  )
}

export function ChoiceGroup({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <fieldset className={cn("space-y-2.5", className)}>
      <legend className="text-[12px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  )
}

export function ChoiceChip({
  selected,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border/50 bg-card/30 text-muted-foreground hover:text-foreground"
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export const authInputClassName =
  "h-11 border-border/40 bg-card/30 px-3 text-[15px]"
