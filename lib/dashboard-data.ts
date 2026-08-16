import {
  Bot,
  ClipboardList,
  Dumbbell,
  Droplets,
  FileText,
  Handshake,
  LayoutDashboard,
  MessageSquare,
  Moon,
  NotebookPen,
  Scale,
  Settings,
  UserRound,
  TrendingUp,
  Utensils,
  type LucideIcon,
} from "lucide-react"

export const metrics = {
  missionScore: 87,
  weight: { value: 279.2, unit: "lb", trend: "0.8 lb", avg: "280.1 lb" },
  waist: { value: 124, unit: "cm", trend: "1 cm", goal: 120 },
  recovery: {
    value: 84,
    trend: "↑ 6% from last week",
    hrv: "42 ms",
    restingHr: "58 bpm",
    sleep: "7h 24m",
  },
}

export const weightTrend = [
  { label: "Jul 28", value: 281.4 },
  { label: "Jul 29", value: 281.0 },
  { label: "Jul 30", value: 280.6 },
  { label: "Jul 31", value: 280.3 },
  { label: "Aug 1", value: 280.0 },
  { label: "Aug 2", value: 279.6 },
  { label: "Aug 3", value: 279.2 },
]

export const missionBreakdown = [
  { label: "Sleep", value: 92 },
  { label: "Activity", value: 85 },
  { label: "Nutrition", value: 78 },
  { label: "Recovery", value: 88 },
]

export const tasks = [
  { id: 1, label: "Log breakfast", done: true },
  { id: 2, label: "Take morning vitamins", done: true },
  { id: 3, label: "45-min upper body workout", done: false },
  { id: 4, label: "Evening recovery walk", done: false },
  { id: 5, label: "Review sleep data", done: false },
]

export const workout = {
  title: "Lower Strength",
  duration: "45 min",
  calories: "~320 kcal",
  time: "6:30 PM",
  exercises: [
    "Back Squat 4×6",
    "Romanian Deadlift 3×10",
    "Leg Press 3×12",
    "Walking Lunges 3×10",
  ],
}

export const aiInsight = {
  body: "Your recovery is trending up this week — HRV is 12% above your baseline. Today is a good day for moderate intensity training. Consider keeping your session under 50 minutes to protect sleep quality tonight.",
  footnote: "Based on sleep, HRV, and training load from the last 7 days",
}

export const dailyBrief = {
  name: "Geoff",
  greeting: "Good morning",
  sleep: {
    duration: "6h 48m",
    deltaLabel: "42 minutes longer than your weekly average",
  },
  weight: {
    direction: "down" as const,
    amount: "0.8 lb",
  },
  recovery: 84,
  focus: "Lower Strength",
  recommendation: "Increase squat working sets by 2.5 kg.",
  nutrition: {
    label: "Protein",
    average: "227g",
    period: "over the last week",
  },
}

export const quickActions = [
  { icon: Scale, label: "Log weight" },
  { icon: Dumbbell, label: "Start workout" },
  { icon: Utensils, label: "Add meal" },
  { icon: MessageSquare, label: "Ask AI" },
]

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  active?: boolean
}

export type NavSection = {
  label: string
  items: NavItem[]
}

export const navSections: NavSection[] = [
  {
    label: "Primary",
    items: [
      { label: "Mission Control", href: "/mission-control", icon: LayoutDashboard },
      { label: "Progress", href: "/progress", icon: TrendingUp },
      { label: "Blood", href: "/blood", icon: Droplets },
      { label: "Training", href: "/training", icon: Dumbbell },
      { label: "Account", href: "/account", icon: UserRound },
    ],
  },
  {
    label: "More",
    items: [
      { label: "Weekly Review", href: "/weekly-review", icon: NotebookPen },
      { label: "Nutrition", href: "/nutrition", icon: Utensils },
      { label: "Treatments", href: "/treatment", icon: ClipboardList },
      { label: "Sleep", href: "/sleep", icon: Moon },
      { label: "AI Coach", href: "/coach", icon: Bot },
      { label: "Coaching", href: "/coaching", icon: Handshake },
      { label: "Data Sources", href: "/import", icon: FileText },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
]

/** @deprecated Use navSections */
export const navPrimary = navSections[0]?.items ?? []
/** @deprecated Use navSections */
export const navHealth = navSections[0]?.items ?? []
/** @deprecated Use navSections */
export const navSecondary = navSections[1]?.items ?? []
/** @deprecated Use navSections */
export const navFooter = navSections[1]?.items ?? []
