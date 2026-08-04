import { AppleHealthImporter } from "./AppleHealthImporter"
import {
  BloodTestImporter,
  ManualBloodTestImporter,
  ScreenshotBloodTestImporter,
} from "./blood-tests"
import { CSVImporter } from "./CSVImporter"
import { HevyImporter } from "./hevy"
import { PhotoImporter } from "./PhotoImporter"
import type { Importer } from "./Importer"

/** Specialised importers — selected by data source, never auto-detected from files. */
export const importers: Importer[] = [
  new AppleHealthImporter(),
  new HevyImporter(),
  new BloodTestImporter(),
  new ScreenshotBloodTestImporter(),
  new ManualBloodTestImporter(),
  new CSVImporter(),
  new PhotoImporter(),
]

export function getImporterById(id: string): Importer | undefined {
  return importers.find((importer) => importer.id === id)
}
