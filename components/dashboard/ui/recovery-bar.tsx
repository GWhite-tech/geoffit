interface RecoveryBarProps {
  value: number
  className?: string
}

export function RecoveryBar({ value, className }: RecoveryBarProps) {
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.06] ${className ?? ""}`}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#6D28D9] to-[#8B5CF6] transition-all duration-700"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}
