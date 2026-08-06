export type ConnectedSourceStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "pending"
  | "coming_soon"
  | "manual"

export type ConnectedSourceProvider =
  | "apple_health"
  | "hevy"
  | "withings"
  | "cronometer"
  | "myfitnesspal"
  | "manual"
  | "csv"
  | "garmin"
  | "polar"
  | "whoop"
  | "oura"
  | "fitbit"
  | "health_connect"

export type ConnectedSourceDefinition = {
  id: ConnectedSourceProvider
  name: string
  description: string
  category: "wearable" | "training" | "nutrition" | "manual" | "import"
  /** Featured in onboarding / primary settings list */
  primary?: boolean
}

export type ConnectedSourceState = {
  provider: ConnectedSourceProvider
  status: ConnectedSourceStatus
  lastSyncAt: string | null
  permissions: string[]
  errorMessage: string | null
  healthOk: boolean
  canSync: boolean
  canDisconnect: boolean
}

export type ConnectedSourceView = ConnectedSourceDefinition & ConnectedSourceState
