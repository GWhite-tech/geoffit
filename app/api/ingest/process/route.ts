import { NextResponse } from "next/server"

import "@/lib/ingestion/parsers/register-all"
import type { DocumentKind } from "@/lib/ingestion/document-kind"
import { getDocumentParser } from "@/lib/ingestion/registry"
import {
  enqueueIngestRun,
  processIngestRun,
} from "@/lib/ingestion/spine/process-run"
import {
  importApiFailure,
  importApiSuccess,
  publicErrorMessage,
} from "@/lib/server/importers"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

type Body = {
  documentKind?: DocumentKind
  fileId?: string
  fileIds?: string[]
  ingestRunId?: string
  retry?: boolean
  leaseOwner?: string
  /** Queue only — do not parse (background worker will call again without this flag). */
  enqueueOnly?: boolean
}

/**
 * Generic ingest processor for every registered document kind.
 * Files must already be in private Storage with user_files + ingest_runs rows.
 */
export async function POST(request: Request) {
  console.info("START_INGEST_PROCESS", {
    path: "/api/ingest/process",
    ts: new Date().toISOString(),
  })
  try {
    const contentType = request.headers.get("content-type") ?? ""
    if (contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        importApiFailure({
          error:
            "Do not upload file bytes here. Upload to Storage, then POST JSON { documentKind, fileId, ingestRunId }.",
        }),
        { status: 413 }
      )
    }

    const body = (await request.json()) as Body
    const documentKind = body.documentKind
    const fileId = body.fileId?.trim()
    const ingestRunId = body.ingestRunId?.trim()
    const leaseOwner =
      body.leaseOwner?.trim() ||
      request.headers.get("x-geoffit-lease-owner")?.trim() ||
      undefined

    if (!documentKind || !fileId || !ingestRunId) {
      return NextResponse.json(
        importApiFailure({
          error: "Required: documentKind, fileId, ingestRunId.",
        }),
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        importApiFailure({ error: "Authentication required." }),
        { status: 401 }
      )
    }

    try {
      getDocumentParser(documentKind)
    } catch {
      return NextResponse.json(
        importApiFailure({
          error: `No parser registered for document kind "${documentKind}".`,
        }),
        { status: 400 }
      )
    }

    if (body.enqueueOnly) {
      await enqueueIngestRun({
        supabase,
        userId: user.id,
        ingestRunId,
        documentKind,
        fileId,
      })
      return NextResponse.json({
        success: true,
        preview: null,
        warnings: [],
        diagnostics: { queued: true, ingestRunId, documentKind },
        error: null,
        payload: null,
      })
    }

    const result = await processIngestRun({
      supabase,
      userId: user.id,
      documentKind,
      fileId,
      fileIds: body.fileIds,
      ingestRunId,
      retry: Boolean(body.retry),
      leaseOwner,
    })

    if (result.skippedConcurrent || result.status === "skipped_concurrent") {
      return NextResponse.json(
        importApiFailure({
          error:
            result.parse.error ??
            "This import is already processing in another session.",
          errorCode: "skipped_concurrent",
          warnings: result.parse.warnings,
          diagnostics: {
            skippedConcurrent: true,
            leaseHeldBy: result.leaseHeldBy ?? null,
            ingestRunId: result.ingestRunId,
            status: result.status,
          },
        }),
        { status: 409 }
      )
    }

    if (!result.parse.success || !result.parse.preview || !result.parse.payload) {
      const errorCode =
        result.parse.diagnostics &&
        typeof result.parse.diagnostics.errorCode === "string"
          ? result.parse.diagnostics.errorCode
          : null
      if (result.parse.error) {
        console.error(
          "[ingest/process] parse failed",
          errorCode,
          result.parse.error,
          result.parse.diagnostics
        )
      }
      return NextResponse.json(
        importApiFailure({
          error: result.parse.error ?? "Ingest parse failed.",
          errorCode,
          warnings: result.parse.warnings,
          preview: result.parse.preview,
          diagnostics: {
            ...(result.parse.diagnostics ?? {}),
            ingestRunId: result.ingestRunId,
            attempt: result.attempt,
            status: result.status,
          },
        }),
        { status: 422 }
      )
    }

    return NextResponse.json(
      importApiSuccess({
        preview: result.parse.preview,
        warnings: result.parse.warnings,
        diagnostics: {
          ...(result.parse.diagnostics ?? {}),
          ingestRunId: result.ingestRunId,
          attempt: result.attempt,
          status: result.status,
          incomplete: result.status === "partial",
          ...(result.facts?.cloudFactPersist
            ? { cloud_fact_persist: result.facts.cloudFactPersist }
            : {}),
          facts: result.facts,
          timeline: result.timeline,
        },
        payload: result.parse.payload,
      }),
      { status: 200 }
    )
  } catch (error) {
    console.error("[ingest/process] unexpected error", error)
    return NextResponse.json(
      importApiFailure({
        error: publicErrorMessage(error, "Unexpected ingest process error."),
        errorCode: "parse_failed",
      }),
      { status: 500 }
    )
  }
}
