import type { ConnectedSourceDefinition } from "./types"

export const CONNECTED_SOURCE_CATALOG: ConnectedSourceDefinition[] = [
  {
    id: "apple_health",
    name: "Apple Health",
    description: "Weight, sleep, activity, and vitals from HealthKit.",
    category: "wearable",
    primary: true,
  },
  {
    id: "hevy",
    name: "Hevy",
    description: "Strength training sessions and exercise history.",
    category: "training",
    primary: true,
  },
  {
    id: "withings",
    name: "Withings",
    description: "Scales, sleep, and body composition.",
    category: "wearable",
    primary: true,
  },
  {
    id: "cronometer",
    name: "Cronometer",
    description: "Nutrition diary and micronutrients.",
    category: "nutrition",
  },
  {
    id: "myfitnesspal",
    name: "MyFitnessPal",
    description: "Meals and calorie tracking.",
    category: "nutrition",
  },
  {
    id: "manual",
    name: "Manual",
    description: "Entries you log yourself in Geoffit.",
    category: "manual",
  },
  {
    id: "csv",
    name: "CSV",
    description: "Spreadsheet imports for custom datasets.",
    category: "import",
  },
  {
    id: "garmin",
    name: "Garmin",
    description: "Workouts, sleep, and daily metrics.",
    category: "wearable",
  },
  {
    id: "polar",
    name: "Polar",
    description: "Training and recovery metrics.",
    category: "wearable",
  },
  {
    id: "whoop",
    name: "WHOOP",
    description: "Strain, recovery, and sleep (scores stay derived).",
    category: "wearable",
  },
  {
    id: "oura",
    name: "Oura",
    description: "Sleep and readiness-related samples.",
    category: "wearable",
  },
  {
    id: "fitbit",
    name: "Fitbit",
    description: "Activity and sleep from Fitbit.",
    category: "wearable",
  },
  {
    id: "health_connect",
    name: "Health Connect",
    description: "Android aggregate health platform.",
    category: "wearable",
  },
]
