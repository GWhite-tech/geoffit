export type MigrationDomain =
  | "profile"
  | "preferences"
  | "measurements"
  | "sleep"
  | "nutrition"
  | "training"
  | "blood"
  | "treatments"
  | "reports"

export type MigrationDomainStatus =
  | "ready"
  | "blocked"
  | "empty"
  | "not_implemented"

export type MigrationDomainEstimate = {
  domain: MigrationDomain
  label: string
  description: string
  estimatedRecords: number
  status: MigrationDomainStatus
}

export type MigrationProgress = {
  phase: "idle" | "planning" | "running" | "complete" | "failed"
  currentDomain: MigrationDomain | null
  completedDomains: MigrationDomain[]
  percent: number
  message: string
}

export type MigrationSummary = {
  generatedAt: string
  domains: MigrationDomainEstimate[]
  totalEstimatedRecords: number
  readyDomains: number
  blockedDomains: number
  explanation: string
}
