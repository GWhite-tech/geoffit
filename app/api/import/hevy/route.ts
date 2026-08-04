import { NextResponse } from "next/server"

import {
  HevyImporter,
  importApiFailure,
  publicErrorMessage,
} from "@/lib/server/importers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BYTES = 25 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json(
        importApiFailure({
          error: "Missing Hevy CSV file. Upload as form field `file`.",
        }),
        { status: 400 }
      )
    }

    const fileName = file.name || "hevy-workouts.csv"
    const isCsv =
      fileName.toLowerCase().endsWith(".csv") ||
      file.type === "text/csv" ||
      file.type === "application/csv"

    if (!isCsv) {
      return NextResponse.json(
        importApiFailure({
          error: "This importer only supports Hevy workout CSV files.",
        }),
        { status: 400 }
      )
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        importApiFailure({
          error: "CSV exceeds the 25MB upload limit.",
        }),
        { status: 400 }
      )
    }

    const importer = new HevyImporter()
    const result = await importer.parseUpload(file)

    return NextResponse.json(result, {
      status: result.success ? 200 : 422,
    })
  } catch (error) {
    return NextResponse.json(
      importApiFailure({
        error: publicErrorMessage(
          error,
          "Unexpected server error while parsing Hevy CSV."
        ),
      }),
      { status: 500 }
    )
  }
}
