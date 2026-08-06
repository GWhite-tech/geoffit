import { cn } from "@/lib/utils"

/** Mobile-first page scaffold — 390px content width, 8pt spacing. */
export function MobilePage({
  children,
  className,
  title,
  subtitle,
}: {
  children: React.ReactNode
  className?: string
  title?: string
  subtitle?: string
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[390px] px-5 pt-6 pb-8 md:max-w-5xl md:px-8 md:pt-10 lg:max-w-[1280px] lg:px-10",
        className
      )}
    >
      {title ? (
        <header className="mb-8">
          <h1 className="text-[34px] font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </header>
      ) : null}
      {children}
    </div>
  )
}
