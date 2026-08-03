"use client"

import { CheckCircle2, Circle, Plus } from "lucide-react"

import { FadeUp } from "@/components/dashboard/motion/stagger"
import { DashboardCard } from "@/components/dashboard/ui/dashboard-card"
import { Button } from "@/components/ui/button"
import { tasks } from "@/lib/dashboard-data"
import { cn } from "@/lib/utils"

export function TasksCard() {
  const completed = tasks.filter((t) => t.done).length

  return (
    <FadeUp className="lg:col-span-6">
      <DashboardCard accent="violet">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
              Today&apos;s Tasks
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {completed} of {tasks.length} complete
            </h2>
          </div>
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#7C3AED]/10 ring-1 ring-[#7C3AED]/20">
            <CheckCircle2 className="size-4 text-[#8B5CF6]" />
          </div>
        </div>

        <ul className="mt-6 space-y-1">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="group/task flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-foreground/[0.03]"
            >
              {task.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-status-positive" />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover/task:text-muted-foreground" />
              )}
              <span
                className={cn(
                  "text-sm",
                  task.done && "text-muted-foreground line-through"
                )}
              >
                {task.label}
              </span>
            </li>
          ))}
        </ul>

        <Button
          variant="outline"
          className="mt-5 h-10 w-full rounded-xl border-foreground/[0.08] bg-transparent"
        >
          <Plus className="size-4" />
          Add task
        </Button>
      </DashboardCard>
    </FadeUp>
  )
}
