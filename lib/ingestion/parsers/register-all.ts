import "server-only"

/**
 * Side-effect import: registers every DocumentParser once per process.
 */

import { registerDocumentParser } from "../registry"
import { appleHealthExportParser } from "./apple-health"
import { bloodLabPdfParser } from "./blood-lab-pdf"
import { bloodScreenshotsParser } from "./blood-screenshots"
import { genericCsvParser } from "./generic-csv"
import { hevyCsvParser } from "./hevy-csv"
import {
  dexaPdfParser,
  ecgParser,
  medicalDocumentParser,
  progressPhotoParser,
} from "./stubs"

let registered = false

export function ensureParsersRegistered(): void {
  if (registered) return
  registerDocumentParser(bloodLabPdfParser)
  registerDocumentParser(bloodScreenshotsParser)
  registerDocumentParser(appleHealthExportParser)
  registerDocumentParser(hevyCsvParser)
  registerDocumentParser(genericCsvParser)
  registerDocumentParser(dexaPdfParser)
  registerDocumentParser(progressPhotoParser)
  registerDocumentParser(ecgParser)
  registerDocumentParser(medicalDocumentParser)
  registered = true
}

ensureParsersRegistered()
