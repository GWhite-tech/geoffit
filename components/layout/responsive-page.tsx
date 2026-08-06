import { cn } from "@/lib/utils"

export function ResponsivePage({
  children,
  className,
  narrow,
}: {
  children: React.ReactNode
  className?: string
  /** Constrain content width (settings/account style) */
  narrow?: boolean
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-8 sm:px-6 lg:px-10 lg:py-12",
        narrow ? "max-w-[760px]" : "max-w-[1280px]",
        className
      )}
    >
      {children}
    </div>
  )
}
