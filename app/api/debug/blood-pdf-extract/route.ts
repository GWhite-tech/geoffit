import { NextResponse } from "next/server"

import { safeRunBloodPdfPipeline } from "@/lib/importers/blood-tests/pipeline/run-pipeline"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Development-only: return full extracted text + structured stage diagnostics
 * for a Storage-backed blood PDF (fileId) or raw upload.
 *
 * POST JSON { fileId }  OR  multipart field `file`
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_BLOOD_PDF_DEBUG !== "1") {
    return NextResponse.json(
      { error: "Debug extract is disabled in production." },
      { status: 404 }
    )
  }

  try {
    let bytes: Uint8Array | null = null
    let fileName = "debug.pdf"

    const contentType = request.headers.get("content-type") ?? ""
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData()
      const file = form.get("file")
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing file." }, { status: 400 })
      }
      fileName = file.name || fileName
      bytes = new Uint8Array(await file.arrayBuffer())
    } else {
      const body = (await request.json()) as { fileId?: string }
      const fileId = body.fileId?.trim()
      if (!fileId) {
        return NextResponse.json(
          { error: "Provide multipart file or JSON { fileId }." },
          { status: 400 }
        )
      }

      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: "Authentication required." }, { status: 401 })
      }

      const { data: row, error } = await supabase
        .from("user_files")
        .select("storage_bucket, storage_path, original_filename")
        .eq("id", fileId)
        .eq("user_id", user.id)
        .maybeSingle()

      if (error || !row) {
        return NextResponse.json({ error: "File not found." }, { status: 404 })
      }

      fileName = row.original_filename || fileName
      const downloaded = await supabase.storage
        .from(row.storage_bucket)
        .download(row.storage_path)
      if (downloaded.error || !downloaded.data) {
        return NextResponse.json(
          { error: downloaded.error?.message ?? "Download failed." },
          { status: 500 }
        )
      }
      bytes = new Uint8Array(await downloaded.data.arrayBuffer())
    }

    const result = await safeRunBloodPdfPipeline(bytes, fileName)

    return NextResponse.json({
      success: result.success,
      failedStage: result.failedStage,
      error: result.error,
      errorCode: result.errorCode,
      warnings: result.warnings,
      structuredLog: result.structuredLog,
      stages: {
        pdfLoader: result.stages.pdfLoader,
        textExtraction: {
          ...result.stages.textExtraction,
          // Keep page previews; full text separately for comparison.
        },
        classification: result.stages.classification,
        textNormalisation: result.stages.textNormalisation,
        providerDetection: result.stages.providerDetection,
        biomarkerParsing: result.stages.biomarkerParsing,
        validation: result.stages.validation,
      },
      extractedText: result.extractedText,
      biomarkerCount: result.biomarkers.length,
      provider: result.bloodTest?.provider ?? null,
      testDate: result.bloodTest?.testDate ?? null,
    })
  } catch (error) {
    console.error("[debug/blood-pdf-extract]", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Debug extract failed.",
      },
      { status: 500 }
    )
  }
}
