/**
 * Multi-provider blood lab PDF fixture contract.
 *
 * Add a new provider by creating:
 *   fixtures/blood-lab-pdfs/<provider>/
 *     report.pdf          — anonymised real PDF (required)
 *     expectations.json   — assertions (required)
 *
 * The regression harness discovers every provider folder that has both files.
 */

import type { PdfClassification } from "./types"

export type BloodLabFixtureExpectations = {
  /** Provider id folder name, e.g. "numan". */
  provider: string
  /** Human label for test titles. */
  label: string
  /** Minimum page count. */
  minPageCount: number
  /** Minimum extracted character count (digital PDFs). */
  minTotalCharacters: number
  /** Maximum extracted characters (image PDFs). */
  maxTotalCharacters?: number
  /** Expected provider string from parser (digital fixtures). */
  expectedProvider?: string
  /** ISO date YYYY-MM-DD, or null to only assert date is present. */
  expectedTestDate?: string | null
  /** Minimum biomarker count (0 for classification-only fixtures). */
  minBiomarkers?: number
  /** Specific marker assertions (key → value/unit). */
  markers?: Array<{
    key: string
    value: number
    unitPattern: string
  }>
  /** Expected PDF classification. */
  expectedClassification?: PdfClassification
  /** @deprecated Prefer expectedClassification. */
  expectedDocumentClass?: PdfClassification
  /** Producer substring, e.g. "WeasyPrint" or "jsPDF". */
  expectedProducerIncludes?: string
  /** Expected OCR decision. */
  expectOcrRequired?: boolean
  /**
   * Whether the full pipeline should succeed.
   * Classification-only image fixtures set this to false.
   */
  expectSuccess?: boolean
  /** Only assert classification / producer / OCR — skip biomarker success. */
  classificationOnly?: boolean
  /** Expected failed stage when expectSuccess is false. */
  expectedFailedStage?: string | null
  /** Expected error code when expectSuccess is false. */
  expectedErrorCode?: string | null
}

export const FIXTURE_ROOT_RELATIVE = "fixtures/blood-lab-pdfs"
