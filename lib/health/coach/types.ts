/**
 * AI Coach domain — grounded intelligence, not a generic chatbot.
 * Architecture supports future LLM / voice / image analysis.
 */

export type CoachTopic =
  | "weight_loss"
  | "blood"
  | "sleep"
  | "medication"
  | "nutrition"
  | "training"
  | "recovery"
  | "protocols"
  | "general"

export type CoachCitationSource =
  | "health"
  | "blood"
  | "nutrition"
  | "treatment"
  | "progress"
  | "sleep"
  | "mission_control"

export type CoachCitation = {
  id: string
  label: string
  source: CoachCitationSource
  detail: string | null
  href: string | null
}

export type CoachAction = {
  id: string
  label: string
  kind:
    | "open_page"
    | "adjust_target"
    | "review_labs"
    | "schedule"
    | "protocol"
    | "other"
  href: string | null
  payload?: Record<string, string | number | boolean>
}

export type CoachChartBlock = {
  type: "chart"
  id: string
  chart:
    | "weight"
    | "hba1c"
    | "body_composition"
    | "sleep"
    | "nutrition"
    | "recovery"
  title: string
  points: Array<{ date: string; label: string; value: number }>
  unit: string
}

export type CoachMetricCardBlock = {
  type: "metric_card"
  id: string
  label: string
  value: string
  detail: string | null
  href: string | null
}

export type CoachTableBlock = {
  type: "table"
  id: string
  headers: string[]
  rows: string[][]
}

export type CoachBloodCardBlock = {
  type: "blood_card"
  id: string
  marker: string
  value: string
  status: string | null
  change: string | null
  href: string | null
}

export type CoachActionBlock = {
  type: "actions"
  id: string
  actions: CoachAction[]
}

export type CoachCitationBlock = {
  type: "citations"
  id: string
  citations: CoachCitation[]
}

export type CoachEvidenceBlock = {
  type: "evidence"
  id: string
  confidence: "Low" | "Medium" | "High"
  why: string
  supporting: string[]
}

export type CoachMessageBlock =
  | { type: "markdown"; id: string; markdown: string }
  | CoachChartBlock
  | CoachMetricCardBlock
  | CoachTableBlock
  | CoachBloodCardBlock
  | CoachActionBlock
  | CoachCitationBlock
  | CoachEvidenceBlock

export type CoachMessageRole = "user" | "coach" | "system"

export type CoachMessage = {
  id: string
  role: CoachMessageRole
  createdAt: string
  /** Plain text fallback / user content */
  text: string
  blocks: CoachMessageBlock[]
  followUps: string[]
}

export type CoachConversation = {
  id: string
  title: string
  topic: CoachTopic
  pinned: boolean
  createdAt: string
  updatedAt: string
  messages: CoachMessage[]
}

/** Snapshot the coach always sees before answering. */
export type CoachHealthContext = {
  generatedAt: string
  hasData: boolean
  currentWeight: { display: string; value: number; unit: string } | null
  healthScore: { score: number | null; change30d: number | null; confidence: string } | null
  recovery: { score: number | null; label: string } | null
  currentProtocol: string | null
  medications: Array<{ name: string; dose: string; startedAt: string | null }>
  proteinAverage: { display: string; value: number; days: number } | null
  caloriesAverage: { display: string; value: number; days: number } | null
  sleepAverage: { display: string; minutes: number; nights: number } | null
  latestBloodTest: {
    date: string
    panel: string
    provider: string
    highlightMarkers: Array<{
      key: string
      label: string
      value: string
      status: string | null
    }>
  } | null
  lastWorkout: {
    date: string
    label: string
    durationDisplay: string
    sourcesLabel: string
  } | null
  weightTrend12w: {
    deltaLb: number | null
    start: number | null
    end: number | null
    points: Array<{ date: string; label: string; value: number }>
  }
  leanMassTrend: {
    deltaLb: number | null
    stable: boolean | null
  }
  hba1c: {
    latest: string | null
    previous: string | null
    deltaDisplay: string | null
    points: Array<{ date: string; label: string; value: number }>
  }
  testosterone: {
    latest: string | null
    status: string | null
    href: string
  }
  bodyFat: {
    latestDisplay: string | null
    deltaDisplay: string | null
  }
  interventions: Array<{ date: string; label: string }>
  storySummary: string[]
  whatsChanged: Array<{ label: string; change: string }>
  correlations: string[]
  nutritionTargets: {
    calories: number
    protein: number
  } | null
  unavailable: string[]
}

export type CoachMemorySnapshot = {
  updatedAt: string
  facts: string[]
  openQuestions: string[]
  focusAreas: string[]
}

export type CoachPromptBundle = {
  systemStyle: string
  contextMarkdown: string
  memoryFacts: string[]
  userQuestion: string
  conversationSummary: string
}

export const COACH_SUGGESTED_QUESTIONS = [
  "Why has my weight loss slowed?",
  "Review my latest blood tests.",
  "How is Retatrutide affecting my progress?",
  "Should I increase protein?",
  "How has my sleep changed this month?",
  "What should I focus on this week?",
  "Explain my testosterone results.",
  "Review my nutrition.",
] as const

export const COACH_TOPIC_LABELS: Record<CoachTopic, string> = {
  weight_loss: "Weight Loss Strategy",
  blood: "Blood Test Review",
  sleep: "Sleep Analysis",
  medication: "Medication Questions",
  nutrition: "Nutrition Review",
  training: "Training Plan",
  recovery: "Recovery",
  protocols: "Protocols",
  general: "General",
}
