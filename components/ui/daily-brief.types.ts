export interface DailyBriefSleep {
  duration: string
  deltaLabel: string
}

export interface DailyBriefWeight {
  direction: "down" | "up" | "unchanged"
  amount: string
}

export interface DailyBriefNutrition {
  label: string
  average: string
  period?: string
}

export interface DailyBriefProps {
  name: string
  greeting?: string
  sleep?: DailyBriefSleep
  weight?: DailyBriefWeight
  recovery?: number | string
  focus: string
  recommendation: string
  nutrition?: DailyBriefNutrition
  className?: string
}
