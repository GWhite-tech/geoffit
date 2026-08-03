import { cn } from "@/lib/utils"

interface SectionLabelProps {
  children: React.ReactNode
  className?: string
}

export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <p
      className={cn(
        "text-[13px] font-medium tracking-[0.18em] text-muted-foreground uppercase",
        className
      )}
    >
      {children}
    </p>
  )
}
