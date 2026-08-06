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
      // Placeholder folders without PDF are skipped.
    }
  }
  return providers.sort()
}

describe("blood lab PDF fixtures", async () => {
  const providers = await discoverProviders()

  it("discovers Numan digital + classification fixtures", () => {
    assert.ok(
      providers.includes("numan"),
      `Expected fixtures/blood-lab-pdfs/numan/. Found: [${providers.join(", ")}]`
    )
    assert.ok(
      providers.includes("numan-weasyprint"),
      "Expected numan-weasyprint classification fixture"
    )
    assert.ok(
      providers.includes("numan-jspdf"),
      "Expected numan-jspdf classification fixture"
    )
  })

  for (const provider of providers) {
    describe(provider, () => {
      it("matches classification / parse expectations", async () => {
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

        const expectSuccess = expectations.expectSuccess !== false
        const expectedClass =
          expectations.expectedClassification ??
          expectations.expectedDocumentClass
        const expectOcr = expectations.expectOcrRequired ?? false

        assert.equal(
          result.structuredLog.parserDecision.ocrRequired,
          expectOcr,
          "OCR decision mismatch"
        )
        assert.equal(
          result.stages.ocr.status,
          expectOcr ? "ok" : "skipped",
          expectOcr
            ? "OCR was required but not run"
            : "OCR must be skipped for this fixture"
        )

        if (expectedClass) {
          assert.equal(
            result.structuredLog.parserDecision.classification,
            expectedClass
          )
          assert.equal(
            result.stages.classification.diagnostics.classification,
            expectedClass
          )
        }

        if (expectations.expectedProducerIncludes) {
          const producer =
            result.stages.classification.diagnostics.producer ??
            result.stages.pdfLoader.diagnostics.documentIdentity?.producer ??
            ""
          assert.match(
            producer,
            new RegExp(expectations.expectedProducerIncludes, "i")
          )
        }

        assert.ok(
          result.structuredLog.pageCount >= expectations.minPageCount,
          `pageCount=${result.structuredLog.pageCount}`
        )
        assert.ok(
          result.structuredLog.totalChars >= expectations.minTotalCharacters,
          `totalChars=${result.structuredLog.totalChars}`
        )
        if (typeof expectations.maxTotalCharacters === "number") {
          assert.ok(
            result.structuredLog.totalChars <= expectations.maxTotalCharacters,
            `totalChars=${result.structuredLog.totalChars} exceeds max`
          )
        }

        if (expectations.classificationOnly) {
          assert.equal(
            result.stages.classification.status,
            "ok",
            "classification stage must succeed"
          )
          return
        }

        if (!expectSuccess) {
          assert.equal(result.success, false)
          if (expectations.expectedFailedStage) {
            assert.equal(result.failedStage, expectations.expectedFailedStage)
          }
          if (expectations.expectedErrorCode) {
            assert.equal(result.errorCode, expectations.expectedErrorCode)
          }
          if (expectations.expectedErrorCode === "image_pdf_unsupported") {
            assert.ok(
              result.error && /image-based export/i.test(result.error),
              `expected image-pdf user message, got: ${result.error}`
            )
          }
          return
        }

        assert.equal(
          result.failedStage,
          null,
          result.error ?? `${provider} pipeline failed`
        )
        assert.equal(result.success, true, result.error ?? "expected success")

        const { bloodTest, biomarkers } = result
        assert.ok(bloodTest, "bloodTest missing")
        if (expectations.expectedProvider) {
          assert.equal(bloodTest.provider, expectations.expectedProvider)
        }
        if (expectations.expectedTestDate) {
          assert.equal(bloodTest.testDate, expectations.expectedTestDate)
        } else if (expectations.expectedTestDate === null) {
          assert.ok(
            bloodTest.testDate && bloodTest.testDate !== "unknown",
            `testDate=${bloodTest.testDate}`
          )
        }

        const minBiomarkers = expectations.minBiomarkers ?? 0
        assert.ok(
          biomarkers.length >= minBiomarkers,
          `biomarkers=${biomarkers.length}`
        )

        for (const markerExpect of expectations.markers ?? []) {
          const marker = biomarkers.find((m) => m.key === markerExpect.key)
          assert.ok(marker, `${markerExpect.key} missing`)
          assert.equal(marker.value, markerExpect.value)
          assert.match(marker.unit, new RegExp(markerExpect.unitPattern, "i"))
        }
      })
    })
  }
})
