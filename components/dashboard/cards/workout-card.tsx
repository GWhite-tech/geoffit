"use client"

import { Activity, Clock, Dumbbell, Flame } from "lucide-react"

import { FadeUp } from "@/components/dashboard/motion/stagger"
import { DashboardCard } from "@/components/dashboard/ui/dashboard-card"
import { Button } from "@/components/ui/button"
import { workout } from "@/lib/dashboard-data"

export function WorkoutCard() {
  return (
    <FadeUp className="lg:col-span-6">
      <DashboardCard accent="amber">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
              Today&apos;s Workout
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {workout.title}
            </h2>
          </div>
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
            <Dumbbell className="size-4 text-amber-400" />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { icon: Clock, label: workout.duration },
            { icon: Flame, label: workout.calories },
            { icon: Activity, label: workout.time },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-xl bg-foreground/[0.04] px-3.5 py-2 text-sm ring-1 ring-foreground/[0.04]"
            >
              <Icon className="size-3.5 text-muted-foreground" />
              <span>{label}</span>
            </div>
          ))}
        </div>

        <ul className="mt-6 space-y-2">
          {workout.exercises.map((exercise) => (
            <li
              key={exercise}
              className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-foreground/[0.03]"
            >
              <span className="size-1.5 rounded-full bg-[#8B5CF6]/70" />
              {exercise}
            </li>
          ))}
        </ul>

        <Button className="mt-6 h-10 w-full rounded-xl">Start Workout</Button>
      </DashboardCard>
    </FadeUp>
  )
}
