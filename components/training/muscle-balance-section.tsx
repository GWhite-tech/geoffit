"use client"

import { useState } from "react"

import { SectionLabel } from "@/components/ui/section-label"
import type {
  MuscleBalanceDetail,
  MuscleBalanceTone,
  MuscleGroupId,
  TrainingView,
} from "@/lib/health/training"
import { cn } from "@/lib/utils"

const TONE_FILL: Record<MuscleBalanceTone, string> = {
  undertrained: "#EF4444",
  below_target: "#F59E0B",
  optimal: "#22C55E",
  high_volume: "#A855F7",
  none: "#6B7280",
}

const TONE_LABEL: Record<MuscleBalanceTone, string> = {
  undertrained: "Undertrained",
  below_target: "Below target",
  optimal: "Optimal",
  high_volume: "High volume",
  none: "No recent training",
}

const FRONT_REGIONS: Array<{
  id: MuscleGroupId
  d: string
}> = [
  {
    id: "shoulders",
    d: "M78 78c8-10 18-14 30-14s22 4 30 14c2 8-2 14-8 16-8-6-16-8-22-8s-14 2-22 8c-6-2-10-8-8-16z",
  },
  {
    id: "chest",
    d: "M86 96c10-8 22-10 30-10s20 2 30 10c4 10 2 22-2 30-10 4-20 6-28 6s-18-2-28-6c-4-8-6-20-2-30z",
  },
  {
    id: "arms",
    d: "M58 96c-8 2-14 12-14 24v36c0 8 4 12 10 12 6 0 10-4 12-10l8-40c2-10-2-20-16-22zm116 0c-14 2-18 12-16 22l8 40c2 6 6 10 12 10s10-4 10-12v-36c0-12-6-22-14-24z",
  },
  {
    id: "core",
    d: "M96 132c8-2 16-2 24 0 6 10 6 24 4 36-8 4-16 4-24 0-2-12-2-26 0-36-1.3 0-2.7 0-4 0z",
  },
  {
    id: "quads",
    d: "M88 174c8-2 16-2 20 2v70c-4 8-10 10-16 8-8-4-10-14-10-26v-44c0-6 2-8 6-10zm36 2c4-4 12-4 20-2 4 2 6 4 6 10v44c0 12-2 22-10 26-6 2-12 0-16-8v-70z",
  },
  {
    id: "calves",
    d: "M94 252c6-2 10 0 12 6v34c-4 6-8 8-12 6-6-2-8-10-6-18v-22c0-4 2-6 6-6zm32 0c4 0 6 2 6 6v22c2 8 0 16-6 18-4 2-8 0-12-6v-34c2-6 6-8 12-6z",
  },
]

const BACK_REGIONS: Array<{
  id: MuscleGroupId
  d: string
}> = [
  {
    id: "shoulders",
    d: "M78 78c8-10 18-14 30-14s22 4 30 14c2 8-2 14-8 16-8-6-16-8-22-8s-14 2-22 8c-6-2-10-8-8-16z",
  },
  {
    id: "back",
    d: "M86 96c10-6 22-8 30-8s20 2 30 8c6 14 4 34-2 48-12 6-24 8-28 8s-16-2-28-8c-6-14-8-34-2-48z",
  },
  {
    id: "arms",
    d: "M58 96c-8 2-14 12-14 24v36c0 8 4 12 10 12 6 0 10-4 12-10l8-40c2-10-2-20-16-22zm116 0c-14 2-18 12-16 22l8 40c2 6 6 10 12 10s10-4 10-12v-36c0-12-6-22-14-24z",
  },
  {
    id: "glutes",
    d: "M92 168c10-4 20-4 28 0 6 8 4 18-2 24-8 4-16 4-24 0-6-6-8-16-2-24z",
  },
  {
    id: "hamstrings",
    d: "M88 196c8-2 16-2 20 2v56c-4 8-10 10-16 8-8-4-10-14-10-26v-30c0-6 2-8 6-10zm36 2c4-4 12-4 20-2 4 2 6 4 6 10v30c0 12-2 22-10 26-6 2-12 0-16-8v-56z",
  },
  {
    id: "calves",
    d: "M94 260c6-2 10 0 12 6v28c-4 6-8 8-12 6-6-2-8-10-6-18v-16c0-4 2-6 6-6zm32 0c4 0 6 2 6 6v16c2 8 0 16-6 18-4 2-8 0-12-6v-28c2-6 6-8 12-6z",
  },
]

function Silhouette({
  regions,
  byId,
  selected,
  onSelect,
}: {
  regions: Array<{ id: MuscleGroupId; d: string }>
  byId: TrainingView["muscleBalance"]["byId"]
  selected: MuscleGroupId | null
  onSelect: (id: MuscleGroupId) => void
}) {
  return (
    <svg viewBox="0 0 232 320" className="mx-auto h-auto w-full max-w-[220px]">
      <ellipse cx="116" cy="42" rx="22" ry="26" fill="#3F3F46" opacity="0.85" />
      <path
        d="M96 66c6 8 14 10 20 10s14-2 20-10c8 4 12 12 12 22v8c-10 4-22 6-32 6s-22-2-32-6v-8c0-10 4-18 12-22z"
        fill="#3F3F46"
        opacity="0.55"
      />
      {regions.map((region) => {
        const tone = byId[region.id]?.tone ?? "none"
        return (
          <path
            key={region.id}
            d={region.d}
            fill={TONE_FILL[tone]}
            fillOpacity={selected === region.id ? 0.95 : 0.72}
            stroke={selected === region.id ? "white" : "transparent"}
            strokeWidth={selected === region.id ? 2 : 0}
            className="cursor-pointer transition-opacity hover:opacity-100"
            onClick={() => onSelect(region.id)}
          >
            <title>{byId[region.id]?.label ?? region.id}</title>
          </path>
        )
      })}
    </svg>
  )
}

function DetailPanel({ group }: { group: MuscleBalanceDetail | null }) {
  if (!group) {
    return (
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        Select a muscle group on the map.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[22px] font-semibold tracking-tight text-foreground">
          {group.label}
        </p>
        <p
          className="mt-1 text-[12px] font-medium tracking-[0.12em] uppercase"
          style={{ color: TONE_FILL[group.tone] }}
        >
          {TONE_LABEL[group.tone]}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-4 text-[14px]">
        <div>
          <dt className="text-muted-foreground">Weekly sets</dt>
          <dd className="mt-1 text-[20px] font-semibold text-foreground">
            {group.weeklySets}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Weekly volume</dt>
          <dd className="mt-1 text-[20px] font-semibold text-foreground">
            {group.weeklyVolumeKg != null
              ? `${group.weeklyVolumeKg.toLocaleString("en-GB")} kg`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last trained</dt>
          <dd className="mt-1 text-foreground">
            {group.lastTrainedLabel ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Recovery</dt>
          <dd className="mt-1 text-foreground">{group.recoveryLabel}</dd>
        </div>
      </dl>
      <p className="text-[13px] text-muted-foreground">
        Target {group.recommendedMin}–{group.recommendedMax} sets / week
        {group.trendLabel ? ` · ${group.trendLabel}` : ""}
      </p>
      {group.topExercises.length > 0 ? (
        <div>
          <p className="text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase">
            Top exercises
          </p>
          <ul className="mt-2 space-y-2">
            {group.topExercises.map((exercise) => (
              <li
                key={exercise.name}
                className="flex justify-between text-[14px] text-foreground"
              >
                <span>{exercise.name}</span>
                <span className="text-muted-foreground">{exercise.sets} sets</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export function MuscleBalanceSection({ view }: { view: TrainingView }) {
  const [face, setFace] = useState<"front" | "back">("front")
  const [selected, setSelected] = useState<MuscleGroupId | null>("chest")
  const group = selected ? view.muscleBalance.byId[selected] ?? null : null

  return (
    <section id="muscle-groups" className="space-y-6">
      <div>
        <SectionLabel>Muscle Balance</SectionLabel>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Weekly volume mapped to the body — click a region for detail.
        </p>
      </div>

      <div className="mc-surface-hero px-5 py-7 sm:px-8 sm:py-10">
        <div className="mb-6 flex flex-wrap gap-0.5">
          {(
            [
              { id: "front", label: "Front" },
              { id: "back", label: "Back" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFace(item.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                face === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          <Silhouette
            regions={face === "front" ? FRONT_REGIONS : BACK_REGIONS}
            byId={view.muscleBalance.byId}
            selected={selected}
            onSelect={setSelected}
          />
          <DetailPanel group={group} />
        </div>

        <ul className="mt-8 flex flex-wrap gap-4 text-[12px] text-muted-foreground">
          {(Object.keys(TONE_LABEL) as MuscleBalanceTone[]).map((tone) => (
            <li key={tone} className="flex items-center gap-2">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ background: TONE_FILL[tone] }}
              />
              {TONE_LABEL[tone]}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
