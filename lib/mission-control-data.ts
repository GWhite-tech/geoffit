export type TrendDirection = "up" | "down" | "neutral" | "positive"

export interface SnapshotMetricData {
  id: string
  label: string
  value: string
  trend: string
  trendDirection?: TrendDirection
  numericValue?: number
  decimals?: number
  suffix?: string
}

export interface ProgressPoint {
  label: string
  value: number
}

export interface ProtocolItem {
  id: string
  label: string
  completed: boolean
  detail?: string
}

export interface StatusModuleData {
  id: string
  label: string
  status: string
  attention: "clear" | "good" | "attention"
}

export interface TimelineEvent {
  id: string
  dateLabel: string
  title: string
  detail?: string
  time: string
}

export const morningBrief = {
  name: "Geoff",
  greeting: "Good morning",
  body:
    "You slept 6h 48m — 42 minutes longer than your weekly average. Weight is down 0.8 lb. Recovery is 84%. Focus on Lower Strength today.",
}

export const snapshotMetrics: SnapshotMetricData[] = [
  {
    id: "weight",
    label: "Weight",
    value: "279.2 lb",
    numericValue: 279.2,
    decimals: 1,
    suffix: " lb",
    trend: "↓ 0.8 today",
    trendDirection: "positive",
  },
  {
    id: "waist",
    label: "Waist",
    value: "124 cm",
    numericValue: 124,
    suffix: " cm",
    trend: "↓ 1 cm",
    trendDirection: "positive",
  },
  {
    id: "recovery",
    label: "Recovery",
    value: "84%",
    numericValue: 84,
    suffix: "%",
    trend: "↑ 6% this week",
    trendDirection: "positive",
  },
  {
    id: "protein",
    label: "Protein",
    value: "227g",
    trend: "on track",
    trendDirection: "neutral",
  },
  {
    id: "sleep",
    label: "Sleep",
    value: "6h 48m",
    trend: "+42m vs avg",
    trendDirection: "positive",
  },
]

export const progressChart = {
  metric: "Weight",
  unit: "lb",
  goal: 275,
  weeklyAverage: 280.1,
  points: [
    { label: "Jul 28", value: 281.4 },
    { label: "Jul 29", value: 281.0 },
    { label: "Jul 30", value: 280.6 },
    { label: "Jul 31", value: 280.3 },
    { label: "Aug 1", value: 280.0 },
    { label: "Aug 2", value: 279.6 },
    { label: "Aug 3", value: 279.2 },
  ] satisfies ProgressPoint[],
}

export const goalProgress = {
  label: "Goal Weight",
  target: 250,
  unit: "lb",
  remaining: 29,
  progress: 0.42,
  estimatedCompletion: "Christmas 2026",
}

export const todaysFocus = {
  workout: {
    title: "Lower Strength",
    time: "6:30 PM",
    duration: "45 min",
    primaryLift: "Back Squat",
    coach: "Geoff",
  },
  protocol: {
    items: [
      { id: "reta", label: "Retatrutide", completed: true },
      { id: "trt", label: "TRT", completed: true },
      { id: "peptides", label: "Peptides", completed: false },
      {
        id: "supplements",
        label: "Supplements",
        completed: false,
        detail: "3/5",
      },
    ] satisfies ProtocolItem[],
  },
}

export const healthStatus: StatusModuleData[] = [
  { id: "blood", label: "Blood Tests", status: "All clear", attention: "clear" },
  { id: "recovery", label: "Recovery", status: "Good", attention: "good" },
  {
    id: "nutrition",
    label: "Nutrition",
    status: "Low protein",
    attention: "attention",
  },
  { id: "sleep", label: "Sleep", status: "OK", attention: "good" },
  {
    id: "hydration",
    label: "Hydration",
    status: "Below target",
    attention: "attention",
  },
  {
    id: "battery",
    label: "Body Battery",
    status: "72%",
    attention: "good",
  },
]

export const timelineEvents: TimelineEvent[] = [
  {
    id: "1",
    dateLabel: "Today",
    title: "Weight logged",
    detail: "279.2 lb",
    time: "7:12 AM",
  },
  {
    id: "2",
    dateLabel: "Yesterday",
    title: "Lower Strength completed",
    time: "6:45 PM",
  },
  {
    id: "3",
    dateLabel: "Mon",
    title: "Blood test imported",
    detail: "Jan panel",
    time: "2:30 PM",
  },
  {
    id: "4",
    dateLabel: "Sun",
    title: "Retatrutide taken",
    time: "8:00 AM",
  },
  {
    id: "5",
    dateLabel: "Sat",
    title: "Progress photo added",
    time: "9:15 AM",
  },
]
