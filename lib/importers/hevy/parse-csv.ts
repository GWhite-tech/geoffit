/**
 * Hevy workout CSV parser.
 *
 * Expected export columns (Hevy → Settings → Export Workouts):
 * title, start_time, end_time, description, exercise_title, superset_id,
 * exercise_notes, set_index, set_type, weight_lbs|weight_kg, reps,
 * distance_miles, duration_seconds, rpe
 *
 * One row per set. Workouts are grouped by title + start_time + end_time.
 * Dates: mobile "28 Mar 2025, 17:29" or desktop "Aug 11, 2026 at 7:56 AM".
 */

import type {
  WorkoutExercise,
  WorkoutSet,
  WorkoutSetType,
} from "@/lib/domain/workout"
import { estimateOneRepMaxKg, isWorkingSet } from "@/lib/health/workout/one-rm"
import {
  exerciseVolumeKg,
  roundVolume,
  workoutVolumeKg,
} from "@/lib/health/workout/volume"
import type { HevyWorkoutEntry } from "@/lib/health/workout/workout-store"

export type HevyCsvRow = {
  title: string
  start_time: string
  end_time: string
  description: string
  exercise_title: string
  superset_id: string
  exercise_notes: string
  set_index: string
  set_type: string
  weight_lbs: string
  weight_kg: string
  reps: string
  distance_miles: string
  duration_seconds: string
  rpe: string
}

export type ParsedHevyCsv = {
  workouts: HevyWorkoutEntry[]
  rowCount: number
  exerciseCount: number
  setCount: number
  warnings: string[]
  dateRange: { start: string; end: string } | null
}

const REQUIRED_HEADERS = [
  "title",
  "start_time",
  "end_time",
  "exercise_title",
] as const

export function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === "," && !inQuotes) {
      cells.push(current)
      current = ""
      continue
    }
    current += char
  }
  cells.push(current)
  return cells.map((cell) => cell.trim())
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/^\ufeff/, "")
    .replace(/\s+/g, "_")
}

function parseNumber(raw: string | undefined): number | undefined {
  if (raw == null) return undefined
  const cleaned = raw.trim().replace(/,/g, "")
  if (!cleaned) return undefined
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : undefined
}

const HEVY_MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
}

function hevyLocalDateToIso(input: {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}): string | null {
  const date = new Date(
    input.year,
    input.month,
    input.day,
    input.hour,
    input.minute,
    input.second
  )
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function hourFromAmPm(hour12: number, meridiem: string): number | null {
  if (hour12 < 1 || hour12 > 12) return null
  const ampm = meridiem.toLowerCase()
  if (ampm === "am") return hour12 === 12 ? 0 : hour12
  if (ampm === "pm") return hour12 === 12 ? 12 : hour12 + 12
  return null
}

/**
 * Hevy mobile: "28 Mar 2025, 17:29"
 * Hevy desktop: "Aug 11, 2026 at 7:56 AM"
 * Also accept ISO strings.
 */
export function parseHevyDateTime(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null

  const iso = Date.parse(value)
  if (!Number.isNaN(iso)) return new Date(iso).toISOString()

  // Mobile: 28 Mar 2025, 17:29  |  28 Mar 2025 17:29
  const mobile = value.match(
    /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  )
  if (mobile) {
    const [, day, mon, year, hour, minute, second] = mobile
    const month = HEVY_MONTHS[mon!.toLowerCase()]
    if (month == null) return null
    return hevyLocalDateToIso({
      year: Number(year),
      month,
      day: Number(day),
      hour: Number(hour),
      minute: Number(minute),
      second: Number(second ?? 0),
    })
  }

  // Desktop: Aug 11, 2026 at 7:56 AM  |  Aug 11, 2026 at 7:56:00 PM
  const desktop = value.match(
    /^([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i
  )
  if (desktop) {
    const [, mon, day, year, hour12, minute, second, meridiem] = desktop
    const month = HEVY_MONTHS[mon!.toLowerCase()]
    if (month == null) return null
    const hour = hourFromAmPm(Number(hour12), meridiem!)
    if (hour == null) return null
    return hevyLocalDateToIso({
      year: Number(year),
      month,
      day: Number(day),
      hour,
      minute: Number(minute),
      second: Number(second ?? 0),
    })
  }

  return null
}

function lbsToKg(lbs: number): number {
  return Math.round(lbs * 0.45359237 * 100) / 100
}

function milesToMeters(miles: number): number {
  return Math.round(miles * 1609.344 * 100) / 100
}

function normalizeSetType(raw: string | undefined): WorkoutSetType {
  const value = (raw ?? "normal").trim().toLowerCase()
  if (value === "warmup" || value === "warm-up" || value === "warm_up") {
    return "warmup"
  }
  if (value === "failure" || value === "fail") return "failure"
  if (value === "dropset" || value === "drop" || value === "drop_set") {
    return "dropset"
  }
  if (value === "normal" || value === "working" || value === "") return "normal"
  return "other"
}

function workoutKey(title: string, start: string, end: string): string {
  return `${title.trim().toLowerCase()}|${start}|${end}`
}

function stableWorkoutId(title: string, start: string, end: string): string {
  const raw = `hevy:${workoutKey(title, start, end)}`
  // Deterministic id without crypto dependency for SSR/node.
  let hash = 0
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0
  }
  return `hevy_${hash.toString(16)}_${start.slice(0, 10)}`
}

function enrichExercise(exercise: WorkoutExercise): WorkoutExercise {
  let best1Rm: number | null = null
  const sets = exercise.sets.map((set) => {
    const estimated1RmKg =
      isWorkingSet(set.setType) && set.weightKg != null && set.reps != null
        ? estimateOneRepMaxKg(set.weightKg, set.reps) ?? undefined
        : undefined
    if (estimated1RmKg != null) {
      if (best1Rm == null || estimated1RmKg > best1Rm) best1Rm = estimated1RmKg
    }
    return { ...set, estimated1RmKg }
  })
  const volumeKg = roundVolume(exerciseVolumeKg({ ...exercise, sets }))
  return {
    ...exercise,
    sets,
    volumeKg,
    estimated1RmKg: best1Rm ?? undefined,
  }
}

export function detectHevyCsvHeaders(headers: string[]): {
  ok: boolean
  missing: string[]
  normalized: string[]
} {
  const normalized = headers.map(normalizeHeader)
  const missing = REQUIRED_HEADERS.filter(
    (required) => !normalized.includes(required)
  )
  return { ok: missing.length === 0, missing, normalized }
}

/**
 * Parse a full Hevy workout export CSV into WorkoutStore entries.
 */
export function parseHevyWorkoutCsv(text: string): ParsedHevyCsv {
  const warnings: string[] = []
  const lines = text
    .replace(/^\ufeff/, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)

  if (lines.length < 2) {
    return {
      workouts: [],
      rowCount: 0,
      exerciseCount: 0,
      setCount: 0,
      warnings: ["CSV must include a header row and at least one set row."],
      dateRange: null,
    }
  }

  const headerCells = parseCsvLine(lines[0]!).map(normalizeHeader)
  const detected = detectHevyCsvHeaders(headerCells)
  if (!detected.ok) {
    return {
      workouts: [],
      rowCount: 0,
      exerciseCount: 0,
      setCount: 0,
      warnings: [
        `Not a Hevy workout export. Missing columns: ${detected.missing.join(", ")}.`,
      ],
      dateRange: null,
    }
  }

  const headerIndex = new Map(headerCells.map((header, i) => [header, i]))
  const cell = (cols: string[], key: string) => {
    const index = headerIndex.get(key)
    return index == null ? "" : (cols[index] ?? "")
  }

  type AccExercise = {
    name: string
    notes: string
    supersetId: string | null
    sets: WorkoutSet[]
  }
  type AccWorkout = {
    title: string
    startDate: string
    endDate: string
    description: string
    exercises: Map<string, AccExercise>
    setCount: number
  }

  const workouts = new Map<string, AccWorkout>()
  let setCount = 0
  let skippedRows = 0

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cols = parseCsvLine(lines[lineIndex]!)
    const title = cell(cols, "title").trim()
    const startRaw = cell(cols, "start_time").trim()
    const endRaw = cell(cols, "end_time").trim()
    const exerciseTitle = cell(cols, "exercise_title").trim()

    if (!title || !startRaw || !endRaw || !exerciseTitle) {
      skippedRows += 1
      continue
    }

    const startDate = parseHevyDateTime(startRaw)
    const endDate = parseHevyDateTime(endRaw)
    if (!startDate || !endDate) {
      skippedRows += 1
      warnings.push(`Could not parse dates on row ${lineIndex + 1}.`)
      continue
    }

    const key = workoutKey(title, startDate, endDate)
    let workout = workouts.get(key)
    if (!workout) {
      workout = {
        title,
        startDate,
        endDate,
        description: cell(cols, "description").trim(),
        exercises: new Map(),
        setCount: 0,
      }
      workouts.set(key, workout)
    }

    const exerciseKey = `${exerciseTitle.toLowerCase()}|${cell(cols, "superset_id")}`
    let exercise = workout.exercises.get(exerciseKey)
    if (!exercise) {
      exercise = {
        name: exerciseTitle,
        notes: cell(cols, "exercise_notes").trim(),
        supersetId: cell(cols, "superset_id").trim() || null,
        sets: [],
      }
      workout.exercises.set(exerciseKey, exercise)
    } else if (!exercise.notes) {
      const notes = cell(cols, "exercise_notes").trim()
      if (notes) exercise.notes = notes
    }

    const weightKgRaw = parseNumber(cell(cols, "weight_kg"))
    const weightLbs = parseNumber(cell(cols, "weight_lbs"))
    const weightKg =
      weightKgRaw != null
        ? weightKgRaw
        : weightLbs != null
          ? lbsToKg(weightLbs)
          : undefined

    const reps = parseNumber(cell(cols, "reps"))
    const rpe = parseNumber(cell(cols, "rpe"))
    const durationSeconds = parseNumber(cell(cols, "duration_seconds"))
    const distanceMiles = parseNumber(cell(cols, "distance_miles"))
    const setIndex = parseNumber(cell(cols, "set_index"))
    const setType = normalizeSetType(cell(cols, "set_type"))

    const set: WorkoutSet = {
      id: `${key}:${exerciseKey}:${exercise.sets.length}`,
      index: setIndex != null ? Math.max(0, Math.round(setIndex)) : exercise.sets.length,
      setType,
      reps: reps != null ? Math.round(reps) : undefined,
      weightKg,
      rpe,
      durationSeconds,
      distanceMeters:
        distanceMiles != null ? milesToMeters(distanceMiles) : undefined,
      completed: true,
    }

    exercise.sets.push(set)
    workout.setCount += 1
    setCount += 1
  }

  if (skippedRows > 0) {
    warnings.push(`${skippedRows} rows were skipped due to missing fields.`)
  }

  const entries: HevyWorkoutEntry[] = [...workouts.values()].map((workout) => {
    const exercises = [...workout.exercises.values()].map((exercise, index) =>
      enrichExercise({
        id: `${stableWorkoutId(workout.title, workout.startDate, workout.endDate)}:ex:${index}`,
        name: exercise.name,
        notes: exercise.notes || undefined,
        sets: exercise.sets,
        supersetId: exercise.supersetId,
      })
    )

    const durationSeconds = Math.max(
      0,
      Math.round(
        (Date.parse(workout.endDate) - Date.parse(workout.startDate)) / 1000
      )
    )

    const volumeKg = roundVolume(workoutVolumeKg(exercises))
    let estimated1RmKg: number | undefined
    for (const exercise of exercises) {
      if (exercise.estimated1RmKg == null) continue
      if (
        estimated1RmKg == null ||
        exercise.estimated1RmKg > estimated1RmKg
      ) {
        estimated1RmKg = exercise.estimated1RmKg
      }
    }

    const rpeValues = exercises.flatMap((exercise) =>
      exercise.sets
        .map((set) => set.rpe)
        .filter((value): value is number => value != null)
    )
    const rpe =
      rpeValues.length > 0
        ? Math.round(
            (rpeValues.reduce((sum, value) => sum + value, 0) /
              rpeValues.length) *
              10
          ) / 10
        : undefined

    const id = stableWorkoutId(workout.title, workout.startDate, workout.endDate)

    return {
      id,
      externalId: id,
      name: workout.title,
      startDate: workout.startDate,
      endDate: workout.endDate,
      durationSeconds,
      activityType: "HKWorkoutActivityTypeTraditionalStrengthTraining",
      exercises,
      volumeKg,
      estimated1RmKg,
      rpe,
      notes: workout.description || undefined,
    } satisfies HevyWorkoutEntry
  })

  entries.sort((a, b) => a.startDate.localeCompare(b.startDate))

  const exerciseCount = entries.reduce(
    (sum, workout) => sum + workout.exercises.length,
    0
  )

  const dateRange =
    entries.length > 0
      ? {
          start: entries[0]!.startDate,
          end: entries[entries.length - 1]!.endDate,
        }
      : null

  return {
    workouts: entries,
    rowCount: lines.length - 1,
    exerciseCount,
    setCount,
    warnings,
    dateRange,
  }
}
