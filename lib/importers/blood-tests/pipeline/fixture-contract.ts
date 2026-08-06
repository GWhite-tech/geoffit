/**
 * Multi-provider blood lab PDF fixture contract.
 *
 * Add a new provider by creating:
 *   fixtures/blood-lab-pdfs/<provider>/
 *     report.pdf          — anonymised real PDF (required)
 *     expectations.json   — assertions (required)
 *
 * The regression harness discovers every provider folder that has both files.
 * No framework code changes are required for Medichecks / Randox / NHS / Optimale.
 */

export type BloodLabFixtureExpectations = {
  /** Provider id folder name, e.g. "numan". */
  provider: string
  /** Human label for test titles. */
  label: string
  /** Minimum page count. */
  minPageCount: number
  /** Minimum extracted character count (digital PDFs). */
  minTotalCharacters: number
  /** Expected provider string from parser. */
  expectedProvider: string
  /** ISO date YYYY-MM-DD, or null to only assert date is present. */
  expectedTestDate: string | null
  /** Minimum biomarker count. */
  minBiomarkers: number
  /** Specific marker assertions (key → value/unit). */
  markers: Array<{
    key: string
    value: number
    unitPattern: string
  }>
  /** Expected document class from classifier. */
  expectedDocumentClass?:
    | "digital_selectable"
    | "sparse_text"
    | "empty_text"
}

export const FIXTURE_ROOT_RELATIVE = "fixtures/blood-lab-pdfs"
