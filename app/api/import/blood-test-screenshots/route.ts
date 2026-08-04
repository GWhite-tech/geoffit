import { NextResponse } from "next/server"

import {
  ScreenshotBloodTestImporter,
  importApiFailure,
  publicErrorMessage,
} from "@/lib/server/importers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const MAX_BYTES_PER_FILE = 15 * 1024 * 1024
const MAX_FILES = 20
const ALLOWED = new Set([".png", ".jpg", ".jpeg", ".heic", ".heif"])

function extensionOf(fileName: string): string {
  return fileName.includes(".")
    ? `.${fileName.split(".").pop()!.toLowerCase()}`
    : ""
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const collected: File[] = []

    for (const value of form.getAll("files")) {
      if (value instanceof File) collected.push(value)
    }
    for (const value of form.getAll("file")) {
      if (value instanceof File) collected.push(value)
    }

    if (collected.length === 0) {
      return NextResponse.json(
        importApiFailure({
          error:
            "Missing screenshots. Upload one or more images as form field `files`.",
        }),
        { status: 400 }
      )
    }

    if (collected.length > MAX_FILES) {
      return NextResponse.json(
        importApiFailure({
          error: `Too many screenshots. Upload at most ${MAX_FILES} images.`,
        }),
        { status: 400 }
      )
    }

    const uploads: Array<{
      bytes: Uint8Array
      fileName: string
      mimeType?: string
    }> = []

    for (const file of collected) {
      const fileName = file.name || "screenshot.png"
      const ext = extensionOf(fileName)
      if (!ALLOWED.has(ext)) {
        return NextResponse.json(
          importApiFailure({
            error: `Unsupported file type (${ext || "unknown"}). Use PNG, JPEG, or HEIC.`,
          }),
          { status: 400 }
        )
      }
      if (file.size > MAX_BYTES_PER_FILE) {
        return NextResponse.json(
          importApiFailure({
            error: `${fileName} exceeds the 15MB per-image limit.`,
          }),
          { status: 400 }
        )
      }
      uploads.push({
        bytes: new Uint8Array(await file.arrayBuffer()),
        fileName,
        mimeType: file.type || undefined,
      })
    }

    const importer = new ScreenshotBloodTestImporter()
    const result = await importer.parseUploads(uploads)

    return NextResponse.json(result, {
      status: result.success ? 200 : 422,
    })
  } catch (error) {
    return NextResponse.json(
      importApiFailure({
        error: publicErrorMessage(
          error,
          "Unexpected server error while parsing blood screenshots."
        ),
      }),
      { status: 500 }
    )
  }
}
