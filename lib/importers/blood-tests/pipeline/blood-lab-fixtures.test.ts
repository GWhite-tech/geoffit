/**
 * Provider-agnostic blood lab PDF regression suite.
 * Discovers fixtures/blood-lab-pdfs/<provider>/{report.pdf,expectations.json}.
 *
 * Run: pnpm test:blood-pdf
 */
import assert from "node:assert/strict"
import { access, readFile, readdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

import type { BloodLabFixtureExpectations } from "./fixture-contract"

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..")
const fixtureRoot = join(root, "fixtures", "blood-lab-pdfs")

async function discoverProviders(): Promise<string[]> {
  const entries = await readdir(fixtureRoot, { withFileTypes: true })
  const providers: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const pdf = join(fixtureRoot, entry.name, "report.pdf")
    const expectations = join(fixtureRoot, entry.name, "expectations.json")
    try {
      await access(pdf)
      await access(expectations)
      providers.push(entry.name)
    } catch {
      // Placeholder folders (medichecks, etc.) without PDF are skipped.
    }
  }
  return providers.sort()
}

describe("blood lab PDF fixtures", async () => {
  const providers = await discoverProviders()

  it("discovers at least the Numan fixture", () => {
    assert.ok(
      providers.includes("numan"),
      `Expected fixtures/blood-lab-pdfs/numan/{report.pdf,expectations.json}. Found: [${providers.join(", ")}]`
    )
  })

  for (const provider of providers) {
    describe(provider, () => {
      it("parses via pdf.js text path and matches expectations", async () => {
        const { runBloodPdfPipeline } = await import("./run-pipeline")
        const dir = join(fixtureRoot, provider)
        const expectations = JSON.parse(
          await readFile(join(dir, "expectations.json"), "utf8")
        ) as BloodLabFixtureExpectations
        const bytes = new Uint8Array(await readFile(join(dir, "report.pdf")))

        const result = await runBloodPdfPipeline(
          bytes,
          `${provider}-report.pdf`
        )

        assert.equal(
          result.failedStage,
          null,
          result.error ?? `${provider} pipeline failed`
        )
        assert.equal(result.success, true, result.error ?? "expected success")

        const { structuredLog, bloodTest, biomarkers } = result
        assert.ok(
          structuredLog.pageCount >= expectations.minPageCount,
          `pageCount=${structuredLog.pageCount}`
        )
        assert.ok(
          structuredLog.totalChars >= expectations.minTotalCharacters,
          `totalChars=${structuredLog.totalChars}`
        )
        assert.equal(structuredLog.parserDecision.ocrRequired, false)
        if (expectations.expectedDocumentClass) {
          assert.equal(
            structuredLog.parserDecision.documentClass,
            expectations.expectedDocumentClass
          )
        }

        assert.ok(bloodTest, "bloodTest missing")
        assert.equal(bloodTest.provider, expectations.expectedProvider)
        if (expectations.expectedTestDate) {
          assert.equal(bloodTest.testDate, expectations.expectedTestDate)
        } else {
          assert.ok(
            bloodTest.testDate && bloodTest.testDate !== "unknown",
            `testDate=${bloodTest.testDate}`
          )
        }
        assert.ok(
          biomarkers.length >= expectations.minBiomarkers,
          `biomarkers=${biomarkers.length}`
        )

        for (const markerExpect of expectations.markers) {
          const marker = biomarkers.find((m) => m.key === markerExpect.key)
          assert.ok(marker, `${markerExpect.key} missing`)
          assert.equal(marker.value, markerExpect.value)
          assert.match(marker.unit, new RegExp(markerExpect.unitPattern, "i"))
        }
      })
    })
  }
})
