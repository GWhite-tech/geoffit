import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Camera,
  Droplets,
  Dumbbell,
  FileSpreadsheet,
  HelpCircle,
  Images,
  PenLine,
} from "lucide-react"

export type DataSourceId =
  | "apple-health"
  | "hevy"
  | "blood-test"
  | "blood-screenshots"
  | "blood-manual"
  | "csv"
  | "progress-photos"
  | "other"

export interface DataSourceDefinition {
  id: DataSourceId
  label: string
  description: string
  /** Importer id to dispatch to. Null = not yet available. */
  importerId: string | null
  acceptedExtensions: string[]
  icon: LucideIcon
  available: boolean
  comingSoonNote?: string
  /** Allow selecting multiple files in the dropzone. */
  allowMultiple?: boolean
  /** Skip file upload — show a manual entry form instead. */
  manualEntry?: boolean
}

export const DATA_SOURCES: DataSourceDefinition[] = [
  {
    id: "apple-health",
    label: "Apple Health",
    description: "export.xml or export.zip from the Health app",
    importerId: "apple-health",
    acceptedExtensions: [".xml", ".zip"],
    icon: Activity,
    available: true,
  },
  {
    id: "blood-manual",
    label: "Manual Blood Entry",
    description: "Type date, biomarker, and value yourself",
    importerId: "blood-test-manual",
    acceptedExtensions: [],
    icon: PenLine,
    available: true,
    manualEntry: true,
  },
  {
    id: "blood-screenshots",
    label: "Blood Screenshots",
    description:
      "Screenshots from NHS App, GP portals, hospital apps, and clinics",
    importerId: "blood-test-screenshots",
    acceptedExtensions: [".png", ".jpg", ".jpeg", ".heic"],
    icon: Camera,
    available: true,
    allowMultiple: true,
  },
  {
    id: "blood-test",
    label: "Blood Test PDF",
    description: "Numan and other lab result PDFs",
    importerId: "blood-test",
    acceptedExtensions: [".pdf"],
    icon: Droplets,
    available: true,
  },
  {
    id: "csv",
    label: "CSV",
    description: "Spreadsheets and tabular health exports",
    importerId: "csv",
    acceptedExtensions: [".csv"],
    icon: FileSpreadsheet,
    available: true,
  },
  {
    id: "hevy",
    label: "Hevy",
    description:
      "Workout CSV export — strength structure merges with Apple Health",
    importerId: "hevy",
    acceptedExtensions: [".csv"],
    icon: Dumbbell,
    available: true,
  },
  {
    id: "progress-photos",
    label: "Progress Photos",
    description: "Body composition and progress images",
    importerId: "progress-photos",
    acceptedExtensions: [".jpg", ".jpeg", ".png", ".heic"],
    icon: Images,
    available: false,
    comingSoonNote:
      "Progress photo import will arrive as a dedicated server importer.",
  },
  {
    id: "other",
    label: "Other",
    description: "Additional sources coming soon",
    importerId: null,
    acceptedExtensions: [],
    icon: HelpCircle,
    available: false,
    comingSoonNote: "More data sources will land here as Geoffit expands.",
  },
]

export function getDataSource(id: DataSourceId): DataSourceDefinition {
  const source = DATA_SOURCES.find((entry) => entry.id === id)
  if (!source) throw new Error(`Unknown data source: ${id}`)
  return source
}
