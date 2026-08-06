"use client"

import { motion } from "framer-motion"

import { TrainingContextSidebar } from "@/components/training/training-context-sidebar"
import { TrainingNav } from "@/components/training/training-nav"
import { TrainingSections } from "@/components/training/training-sections"
import { RangePills } from "@/components/training/training-charts"
import {
  useTraining,
  useTrainingControls,
  type TrainingRange,
} from "@/lib/health/training"
import { transitions } from "@/lib/theme"

const RANGES: { id: TrainingRange; label: string }[] = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "6m", label: "6M" },
  { id: "1y", label: "1Y" },
  { id: "all", label: "All" },
]

export function TrainingWorkspace() {
  const view = useTraining()
  const controls = useTrainingControls()

  return (
    <div className="flex min-h-0 w-full md:h-[calc(100svh-2.75rem)] md:overflow-hidden">
      <div className="hidden h-full w-[260px] shrink-0 overflow-y-auto xl:block">
        <TrainingNav view={view} />
      </div>

      <div className="min-w-0 flex-1 md:overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitions.fadeUp}
          className="mx-auto flex w-full max-w-[390px] flex-col gap-12 px-5 py-6 md:max-w-[1100px] md:gap-16 md:py-8 lg:px-10"
        >
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[34px] font-semibold tracking-tight text-foreground sm:text-[40px]">
                Training
              </h1>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                Am I getting stronger? Fitter? Consistent? Analytics — not a
                workout diary.
              </p>
            </div>
            <RangePills
              items={RANGES}
              value={controls.range}
              onChange={controls.setRange}
            />
          </header>

          {!view.hasData ? (
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Import Hevy strength sessions and Apple Health cardio, steps, and
              recovery to unlock Training analytics.
            </p>
          ) : null}

          <TrainingSections
            view={view}
            strengthMetric={controls.strengthMetric}
            onStrengthMetric={controls.setStrengthMetric}
            selectedExercise={controls.selectedExercise}
            onSelectExercise={(name) => controls.setSelectedExercise(name)}
            stepRange={controls.stepRange}
            onStepRange={controls.setStepRange}
            goals={controls.goals}
            onGoalsChange={controls.setGoals}
            onActivateProgramme={controls.activateProgramme}
            onDeactivateProgramme={controls.deactivateProgramme}
          />
        </motion.div>
      </div>

      <div className="hidden h-full w-[280px] shrink-0 overflow-y-auto xl:block">
        <TrainingContextSidebar view={view} />
      </div>
    </div>
  )
}
