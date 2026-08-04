import { NextResponse } from "next/server"

import {
  AppleHealthImporter,
  importApiFailure,
  publicErrorMessage,
} from "@/lib/server/importers"
import {
  createDefaultImportProfile,
  type ImportProfileToggles,
} from "@/lib/importers/apple-health/import-profile"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const MAX_BYTES = 512 * 1024 * 1024

function parseProfile(raw: FormDataEntryValue | null): ImportProfileToggles {
  if (typeof raw !== "string" || !raw.trim()) {
    return createDefaultImportProfile()
  }
  try {
    return {
      ...createDefaultImportProfile(),
      ...(JSON.parse(raw) as ImportProfileToggles),
    }
  } catch {
    return createDefaultImportProfile()
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json(
        importApiFailure({
          error: "Missing file. Upload as form field `file`.",
        }),
        { status: 400 }
      )
    }

    const fileName = file.name || "export.zip"
    const extension = fileName.split(".").pop()?.toLowerCase() ?? ""
    if (extension !== "xml" && extension !== "zip") {
      return NextResponse.json(
        importApiFailure({
          error:
            "This importer only supports Apple Health .xml or .zip exports.",
        }),
        { status: 400 }
      )
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        importApiFailure({
          error: "Apple Health export exceeds the 512MB upload limit.",
        }),
        { status: 400 }
      )
    }

    const profile = parseProfile(form.get("profile"))
    const importer = new AppleHealthImporter()
    const result = await importer.parseUpload(file, { profile })

    return NextResponse.json(result, {
      status: result.success ? 200 : 422,
    })
  } catch (error) {
    return NextResponse.json(
      importApiFailure({
        error: publicErrorMessage(
          error,
          "Unexpected server error while parsing Apple Health export."
        ),
      }),
      { status: 500 }
    )
  }
}
