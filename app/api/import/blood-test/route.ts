import { NextResponse } from "next/server"

import {
  BloodTestImporter,
  importApiFailure,
  publicErrorMessage,
} from "@/lib/server/importers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const MAX_BYTES = 25 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json(
        importApiFailure({
          error: "Missing PDF file. Upload a blood-test PDF as form field `file`.",
        }),
        { status: 400 }
      )
    }

    const fileName = file.name || "blood-test.pdf"
    const isPdf =
      fileName.toLowerCase().endsWith(".pdf") || file.type === "application/pdf"

    if (!isPdf) {
      return NextResponse.json(
        importApiFailure({
          error: "This importer only supports PDF blood test reports.",
        }),
        { status: 400 }
      )
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        importApiFailure({
          error: "PDF exceeds the 25MB upload limit.",
        }),
        { status: 400 }
      )
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const importer = new BloodTestImporter()
    const result = await importer.parseUpload(bytes, fileName)

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
