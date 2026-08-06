import { NextResponse } from "next/server"

import "@/lib/ingestion/parsers/register-all"
import { processIngestRun } from "@/lib/ingestion/spine/process-run"
import {
  importApiFailure,
  importApiSuccess,
  publicErrorMessage,
} from "@/lib/server/importers"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

type ParseRequestBody = {
  fileId?: string
  ingestRunId?: string
  retry?: boolean
}

/**
 * Blood lab PDF — thin alias over the generic ingestion processor.
 * Prefer POST /api/ingest/process { documentKind: "blood_lab_pdf", ... }.
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? ""
    if (contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        importApiFailure({
          error:
            "Blood PDFs must upload directly to Storage. POST JSON { fileId, ingestRunId } only.",
        }),
        { status: 413 }
      )
    }

    const body = (await request.json()) as ParseRequestBody
    const fileId = body.fileId?.trim()
    const ingestRunId = body.ingestRunId?.trim()

    if (!fileId || !ingestRunId) {
      return NextResponse.json(
        importApiFailure({
          error: "Missing fileId or ingestRunId. Upload to Storage first.",
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

    const result = await processIngestRun({
      supabase,
      userId: user.id,
      documentKind: "blood_lab_pdf",
      fileId,
      ingestRunId,
      retry: Boolean(body.retry),
    })

    if (!result.parse.success || !result.parse.preview || !result.parse.payload) {
      return NextResponse.json(
        importApiFailure({
          error: result.parse.error ?? "Blood-test parse failed.",
          warnings: result.parse.warnings,
          preview: result.parse.preview,
          diagnostics: result.parse.diagnostics,
        }),
        { status: 422 }
      )
    }

    return NextResponse.json(
      importApiSuccess({
        preview: result.parse.preview,
        warnings: result.parse.warnings,
        diagnostics: result.parse.diagnostics,
        payload: result.parse.payload,
      }),
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      importApiFailure({
        error: publicErrorMessage(
          error,
          "Unexpected server error while parsing blood-test PDF."
        ),
      }),
      { status: 500 }
    )
  }
}
