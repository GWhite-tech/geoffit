"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"

import { AddTreatmentButton } from "@/components/treatment/add-treatment-dialog"
import { TodaySidebar } from "@/components/treatment/today-sidebar"
import { TreatmentNav } from "@/components/treatment/treatment-nav"
import { WeeklyPlanner } from "@/components/treatment/weekly-planner"
import {
  useTreatmentNav,
  useTreatmentStoreVersion,
} from "@/lib/health/treatment"
import { transitions } from "@/lib/theme"

export function TreatmentWorkspace({
  selectedId,
}: {
  selectedId?: string
}) {
  const router = useRouter()
  useTreatmentStoreVersion()
  const groups = useTreatmentNav("")

  const options = useMemo(
    () =>
      groups.flatMap((group) =>
        group.items.map((item) => ({
          id: item.treatment.id,
          label: `${item.treatment.shortName} · ${group.label}`,
        }))
      ),
    [groups]
  )

  function selectTreatment(id: string) {
    router.push(`/treatment/${id}`)
  }

  return (
    <div className="flex h-[calc(100svh-2.75rem)] w-full overflow-hidden">
      <div className="hidden h-full w-[300px] shrink-0 overflow-y-auto lg:block">
        <TreatmentNav
          activeId={selectedId ?? null}
          onSelect={selectTreatment}
        />
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="border-b border-border/30 px-5 py-3 lg:hidden">
          <label className="sr-only" htmlFor="treatment-select">
            Select treatment
          </label>
          <select
            id="treatment-select"
            value={selectedId ?? ""}
            onChange={(event) => {
              if (event.target.value) selectTreatment(event.target.value)
            }}
            className="h-10 w-full rounded-xl border border-border/40 bg-card/30 px-3 text-[14px] text-foreground outline-none"
          >
            <option value="">Weekly planner</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitions.fadeUp}
          className="mx-auto flex w-full max-w-[1100px] flex-col gap-10 px-5 py-8 lg:px-10"
        >
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground/70 uppercase">
                Treatment OS
              </p>
              <h1 className="mt-3 text-[34px] font-semibold tracking-tight text-foreground sm:text-[40px]">
                Treatments
              </h1>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                Prescriptions, peptides, and supplements in one weekly operating
                system — feeding Timeline, Mission Control, and analytics.
              </p>
            </div>
            <AddTreatmentButton
              label="Add treatment"
              className="h-10 border border-border/40 bg-card/30 px-4"
            />
          </header>

          <WeeklyPlanner />
        </motion.div>
      </div>

      <div className="hidden h-full w-[280px] shrink-0 overflow-y-auto xl:block">
        <TodaySidebar />
      </div>
    </div>
  )
}
