"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

import { SourceCard } from "@/components/connected-sources/source-card"
import { usePreferences } from "@/components/preferences/preferences-provider"
import { Button } from "@/components/ui/button"
import { useProfile } from "@/hooks/auth"
import { getPrimaryConnectedSources } from "@/lib/connected-sources"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

const STEPS = ["welcome", "theme", "units", "sources", "complete"] as const
type Step = (typeof STEPS)[number]

export function OnboardingWizard() {
  const router = useRouter()
  const { greetingName } = useProfile()
  const { preferences, updatePreferences, completeOnboarding } =
    usePreferences()
  const [stepIndex, setStepIndex] = useState(0)
  const step = STEPS[stepIndex]!
  const sources = useMemo(() => getPrimaryConnectedSources(), [])

  if (!preferences?.show_welcome_screen) return null

  async function finish() {
    await completeOnboarding()
    router.replace("/mission-control")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 px-4 backdrop-blur-md">
      <div className="w-full max-w-[520px] rounded-2xl border border-border/50 bg-card/80 p-6 shadow-[var(--shadow-card)] sm:p-8">
        <p className="text-[12px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Step {stepIndex + 1} of {STEPS.length}
        </p>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transitions.fadeUp}
            className="mt-5"
          >
            {step === "welcome" ? (
              <>
                <h2 className="text-[28px] font-semibold tracking-tight">
                  Welcome to Geoffit, {greetingName}
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                  Let&apos;s set a few defaults so Mission Control feels like
                  yours from day one.
                </p>
              </>
            ) : null}

            {step === "theme" ? (
              <>
                <h2 className="text-[28px] font-semibold tracking-tight">
                  Choose your look
                </h2>
                <div className="mt-6 flex flex-wrap gap-2">
                  {(["light", "dark", "system"] as const).map((theme) => (
                    <Chip
                      key={theme}
                      active={preferences.theme === theme}
                      onClick={() => void updatePreferences({ theme })}
                      label={theme[0]!.toUpperCase() + theme.slice(1)}
                    />
                  ))}
                </div>
              </>
            ) : null}

            {step === "units" ? (
              <>
                <h2 className="text-[28px] font-semibold tracking-tight">
                  Units
                </h2>
                <div className="mt-6 flex flex-wrap gap-2">
                  {(["metric", "imperial"] as const).map((units) => (
                    <Chip
                      key={units}
                      active={preferences.units === units}
                      onClick={() =>
                        void updatePreferences({
                          units,
                          preferred_weight_unit:
                            units === "imperial" ? "lb" : "kg",
                          preferred_distance_unit:
                            units === "imperial" ? "mi" : "km",
                        })
                      }
                      label={units[0]!.toUpperCase() + units.slice(1)}
                    />
                  ))}
                </div>
              </>
            ) : null}

            {step === "sources" ? (
              <>
                <h2 className="text-[28px] font-semibold tracking-tight">
                  Health sources
                </h2>
                <p className="mt-2 text-[14px] text-muted-foreground">
                  Connect later anytime — you can skip this step.
                </p>
                <div className="mt-5 max-h-[280px] space-y-3 overflow-y-auto">
                  {sources.map((source) => (
                    <SourceCard key={source.id} source={source} compact />
                  ))}
                </div>
              </>
            ) : null}

            {step === "complete" ? (
              <>
                <h2 className="text-[28px] font-semibold tracking-tight">
                  You&apos;re ready
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                  Head to Mission Control. You can refine preferences in
                  Settings whenever you like.
                </p>
              </>
            ) : null}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            className="h-9"
            onClick={() => void finish()}
          >
            Skip
          </Button>
          <div className="flex gap-2">
            {stepIndex > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="h-9"
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              >
                Back
              </Button>
            ) : null}
            {step === "complete" ? (
              <Button type="button" className="h-9" onClick={() => void finish()}>
                Go to Mission Control
              </Button>
            ) : (
              <Button
                type="button"
                className="h-9"
                onClick={() =>
                  setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))
                }
              >
                Continue
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-[14px] transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border/50 bg-card/40 text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  )
}
