import { NextResponse } from "next/server"

import {
  BloodTestImporter,
  importApiFailure,
  publicErrorMessage,
} from "@/lib/server/importers"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

type ParseRequestBody = {
  /** user_files.id */
  fileId?: string
  /** ingest_runs.id */
  ingestRunId?: string
}

/**
 * Parse a blood-test PDF already stored in private Supabase Storage.
 * Does NOT accept multipart file bodies (avoids Vercel FUNCTION_PAYLOAD_TOO_LARGE).
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? ""
    if (contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        importApiFailure({
          error:
            "Blood PDFs must upload directly to Storage. POST JSON { fileId, ingestRunId } only — do not send the file through this route.",
        }),
        { status: 413 }
      )
    }

    const body = (await request.json()) as ParseRequestBody
    const fileId = body.fileId?.trim()
    const ingestRunId = body.ingestRunId?.trim()

    if (!fileId) {
      return NextResponse.json(
        importApiFailure({
          error: "Missing fileId. Upload the PDF to Storage first.",
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

    const { data: fileRow, error: fileError } = await supabase
      .from("user_files")
      .select("*")
      .eq("id", fileId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle()

    if (fileError) {
      return NextResponse.json(
        importApiFailure({ error: fileError.message }),
        { status: 500 }
      )
    }

    if (!fileRow) {
      return NextResponse.json(
        importApiFailure({ error: "Upload not found." }),
        { status: 404 }
      )
    }

    const isPdf =
      String(fileRow.mime_type) === "application/pdf" ||
      String(fileRow.original_filename ?? "")
        .toLowerCase()
        .endsWith(".pdf") ||
      String(fileRow.purpose) === "lab_pdf"

    if (!isPdf) {
      return NextResponse.json(
        importApiFailure({
          error: "This importer only supports PDF blood test reports.",
        }),
        { status: 400 }
      )
    }

    if (ingestRunId) {
      await supabase
        .from("ingest_runs")
        .update({
          status: "running",
          started_at: new Date().toISOString(),
        })
        .eq("id", ingestRunId)
        .eq("user_id", user.id)
    }

    const { data: blob, error: downloadError } = await supabase.storage
      .from(String(fileRow.storage_bucket))
      .download(String(fileRow.storage_path))

    if (downloadError || !blob) {
      if (ingestRunId) {
        await supabase
          .from("ingest_runs")
          .update({
            status: "failed",
            finished_at: new Date().toISOString(),
            error_summary: downloadError?.message ?? "Storage download failed",
          })
          .eq("id", ingestRunId)
          .eq("user_id", user.id)
      }
      return NextResponse.json(
        importApiFailure({
          error: downloadError?.message ?? "Could not download stored PDF.",
        }),
        { status: 502 }
      )
    }

    const bytes = new Uint8Array(await blob.arrayBuffer())
    const fileName =
      String(fileRow.original_filename ?? "").trim() || "blood-test.pdf"

    const importer = new BloodTestImporter()
    const result = await importer.parseUpload(bytes, fileName)

    if (ingestRunId) {
      await supabase
        .from("ingest_runs")
        .update({
          status: result.success ? "succeeded" : "failed",
          finished_at: new Date().toISOString(),
          error_summary: result.success ? null : result.error,
          stats: {
            file_id: fileId,
            storage_bucket: fileRow.storage_bucket,
            storage_path: fileRow.storage_path,
            byte_size: fileRow.byte_size,
            checksum: fileRow.checksum,
            biomarker_count:
              result.diagnostics &&
              typeof result.diagnostics === "object" &&
              "biomarkerCount" in result.diagnostics
                ? (result.diagnostics as { biomarkerCount?: number })
                    .biomarkerCount
                : undefined,
          },
        })
        .eq("id", ingestRunId)
        .eq("user_id", user.id)
    }

    return NextResponse.json(result, {
      status: result.success ? 200 : 422,
    })
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
