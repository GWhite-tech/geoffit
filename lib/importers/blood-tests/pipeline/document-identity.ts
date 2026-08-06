/**
 * Prove which PDF bytes are being processed — identity only, no parse changes.
 */

import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { logBloodPdfPipeline } from "./log"

export const NUMAN_FIXTURE_RELATIVE_PATH =
  "fixtures/blood-lab-pdfs/numan/report.pdf"

/** Known stand-in fixture identity (recomputed live when the file is present). */
export const NUMAN_FIXTURE_KNOWN = {
  relativePath: NUMAN_FIXTURE_RELATIVE_PATH,
  byteLength: 18993,
  sha256:
    "e42b97f427329323399ebddb13667db62384b107b5408e45387a138720393ef8",
} as const

export type PdfDocumentIdentity = {
  originalFilename: string
  sha256: string
  byteLength: number
  pageCount: number | null
  pdfVersion: string | null
  producer: string | null
  creator: string | null
  title: string | null
  author: string | null
  firstPageTitleText: string | null
  firstPageItemCount: number | null
  firstPageCharCount: number | null
}

export type FixtureComparison = {
  fixturePath: string
  fixtureSha256: string | null
  fixtureByteLength: number | null
  fixtureReadable: boolean
  sameSha256: boolean
  sameByteLength: boolean
  sameDocument: boolean
  verdict: string
}

export function sha256HexOfBytes(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex")
}

async function loadNumanFixtureIdentity(): Promise<{
  sha256: string
  byteLength: number
  readable: boolean
  path: string
}> {
  // Fixture compare is diagnostics-only. Ignore for NFT — do not pull fixtures/
  // or the whole project into the serverless package.
  const path = join(
    /* turbopackIgnore: true */ process.cwd(),
    NUMAN_FIXTURE_RELATIVE_PATH
  )
  try {
    const buf = await readFile(/* turbopackIgnore: true */ path)
    return {
      path,
      byteLength: buf.byteLength,
      sha256: sha256HexOfBytes(buf),
      readable: true,
    }
  } catch {
    return {
      path,
      byteLength: NUMAN_FIXTURE_KNOWN.byteLength,
      sha256: NUMAN_FIXTURE_KNOWN.sha256,
      readable: false,
    }
  }
}

export function compareToNumanFixture(input: {
  sha256: string
  byteLength: number
  fixture: Awaited<ReturnType<typeof loadNumanFixtureIdentity>>
}): FixtureComparison {
  const sameSha256 = input.sha256 === input.fixture.sha256
  const sameByteLength = input.byteLength === input.fixture.byteLength
  const sameDocument = sameSha256

  let verdict: string
  if (sameDocument) {
    verdict =
      "UPLOADED FILE MATCHES the Numan regression fixture (identical SHA-256). " +
      "Any ~11 chars/page result is from pdf.js on THIS same document — not a different upload."
  } else {
    verdict =
      "UPLOADED FILE DIFFERS from the Numan regression fixture. " +
      `upload sha256=${input.sha256} size=${input.byteLength}; ` +
      `fixture sha256=${input.fixture.sha256} size=${input.fixture.byteLength}. ` +
      "Do not treat image-only upload symptoms as properties of the selectable-text fixture."
  }

  return {
    fixturePath: input.fixture.path,
    fixtureSha256: input.fixture.sha256,
    fixtureByteLength: input.fixture.byteLength,
    fixtureReadable: input.fixture.readable,
    sameSha256,
    sameByteLength,
    sameDocument,
    verdict,
  }
}

/**
 * Log byte identity immediately (before getDocument / text extraction).
 */
export async function logUploadBytesIdentity(
  data: Uint8Array,
  originalFilename: string
): Promise<{ sha256: string; comparison: FixtureComparison }> {
  const sha256 = sha256HexOfBytes(data)
  const fixture = await loadNumanFixtureIdentity()
  const comparison = compareToNumanFixture({
    sha256,
    byteLength: data.byteLength,
    fixture,
  })

  logBloodPdfPipeline("document_identity_bytes", {
    originalFilename,
    sha256,
    byteLength: data.byteLength,
    fixtureComparison: comparison,
  })

  return { sha256, comparison }
}

type PdfDoc = {
  numPages: number
  getMetadata: () => Promise<{ info?: object }>
  getPage: (n: number) => Promise<{
    getTextContent: (params?: {
      includeMarkedContent?: boolean
    }) => Promise<{ items: unknown[] }>
  }>
}

/**
 * After PDF open, log metadata + first-page title sample, then restate fixture compare.
 * Does not alter extraction/parsing behaviour.
 */
export async function logOpenedDocumentIdentity(input: {
  doc: PdfDoc
  originalFilename: string
  sha256: string
  byteLength: number
  comparison: FixtureComparison
}): Promise<PdfDocumentIdentity> {
  let pdfVersion: string | null = null
  let producer: string | null = null
  let creator: string | null = null
  let title: string | null = null
  let author: string | null = null

  try {
    const meta = await input.doc.getMetadata()
    const info = (meta.info ?? {}) as Record<string, unknown>
    pdfVersion =
      typeof info.PDFFormatVersion === "string" ? info.PDFFormatVersion : null
    producer = typeof info.Producer === "string" ? info.Producer : null
    creator = typeof info.Creator === "string" ? info.Creator : null
    title = typeof info.Title === "string" ? info.Title : null
    author = typeof info.Author === "string" ? info.Author : null
  } catch {
    // Identity logging must not fail the pipeline.
  }

  let firstPageTitleText: string | null = null
  let firstPageItemCount: number | null = null
  let firstPageCharCount: number | null = null

  try {
    if (input.doc.numPages >= 1) {
      const page = await input.doc.getPage(1)
      const content = await page.getTextContent({ includeMarkedContent: false })
      const strs = content.items
        .map((item) =>
          item && typeof item === "object" && "str" in item
            ? String((item as { str?: string }).str ?? "")
            : ""
        )
        .filter((s) => s.trim().length > 0)
      firstPageItemCount = content.items.length
      firstPageTitleText = strs.slice(0, 12).join(" | ").slice(0, 500)
      firstPageCharCount = strs.join("").length
    }
  } catch {
    // Identity logging must not fail the pipeline.
  }

  const identity: PdfDocumentIdentity = {
    originalFilename: input.originalFilename,
    sha256: input.sha256,
    byteLength: input.byteLength,
    pageCount: input.doc.numPages,
    pdfVersion,
    producer,
    creator,
    title,
    author,
    firstPageTitleText,
    firstPageItemCount,
    firstPageCharCount,
  }

  logBloodPdfPipeline("document_identity_opened", {
    ...identity,
    fixtureComparison: input.comparison,
  })

  // Explicit human-readable line for Vercel log search.
  logBloodPdfPipeline("document_identity_verdict", {
    originalFilename: identity.originalFilename,
    sha256: identity.sha256,
    byteLength: identity.byteLength,
    pageCount: identity.pageCount,
    producer: identity.producer,
    creator: identity.creator,
    firstPageTitleText: identity.firstPageTitleText,
    firstPageCharCount: identity.firstPageCharCount,
    sameAsNumanFixture: input.comparison.sameDocument,
    verdict: input.comparison.verdict,
  })

  return identity
}
