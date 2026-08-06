/**
 * Browser → private Supabase Storage upload (no Next.js proxy).
 * Creates ingest_runs + user_files metadata; supports checksum idempotency
 * and TUS resumable uploads for larger files.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import * as tus from "tus-js-client"

import { getSupabaseEnv } from "@/lib/supabase/env"

import { buildStorageObjectPath, sha256Hex } from "./checksum"
import type {
  IngestUploadResult,
  IngestUploadSpec,
  UserFileRow,
} from "./types"

const RESUMABLE_THRESHOLD_BYTES = 6 * 1024 * 1024
const TUS_CHUNK_SIZE = 6 * 1024 * 1024

async function ensureProfileBeforeIngest(
  supabase: SupabaseClient
): Promise<{ userId: string; accessToken: string }> {
  const { ensureAuthenticatedProfile } = await import("@/lib/auth/profile")

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error("Sign in to upload files to Geoffit Cloud.")
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error("Missing auth session for Storage upload.")
  }

  // ingest_runs.user_id → profiles.id; never insert without a profiles row.
  await ensureAuthenticatedProfile(supabase, user)

  return { userId: user.id, accessToken: session.access_token }
}

function mapUserFile(row: Record<string, unknown>): UserFileRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    purpose: row.purpose as UserFileRow["purpose"],
    storage_bucket: String(row.storage_bucket),
    storage_path: String(row.storage_path),
    mime_type: String(row.mime_type),
    byte_size: Number(row.byte_size),
    checksum: row.checksum == null ? null : String(row.checksum),
    original_filename:
      row.original_filename == null ? null : String(row.original_filename),
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null,
    created_at: String(row.created_at),
  }
}

function extensionOf(fileName: string): string {
  return fileName.includes(".")
    ? `.${fileName.split(".").pop()!.toLowerCase()}`
    : ""
}

function assertAccepted(file: File, spec: IngestUploadSpec): void {
  const ext = extensionOf(file.name)
  const mimeOk =
    !file.type ||
    spec.acceptedMimeTypes.includes(file.type) ||
    file.type === "application/octet-stream"
  const extOk = spec.acceptedExtensions.includes(ext)
  if (!mimeOk && !extOk) {
    throw new Error(
      `Unsupported file type for ${spec.documentKind}. Accepted: ${spec.acceptedExtensions.join(", ")}`
    )
  }
  if (file.size > spec.maxBytes) {
    throw new Error(
      `File exceeds the ${Math.round(spec.maxBytes / (1024 * 1024))}MB upload limit.`
    )
  }
  if (file.size <= 0) {
    throw new Error("File is empty.")
  }
}

function storageHostname(projectUrl: string): string {
  try {
    const u = new URL(projectUrl)
    // Prefer direct storage host for large uploads when using *.supabase.co
    if (u.hostname.endsWith(".supabase.co") && !u.hostname.includes("storage.")) {
      const projectRef = u.hostname.split(".")[0]
      return `https://${projectRef}.storage.supabase.co`
    }
    return projectUrl.replace(/\/$/, "")
  } catch {
    return projectUrl.replace(/\/$/, "")
  }
}

async function uploadViaStandardApi(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  file: File
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type || "application/octet-stream",
    upsert: false,
  })
  if (error) throw new Error(error.message)
}

async function uploadViaTus(input: {
  accessToken: string
  projectUrl: string
  bucket: string
  path: string
  file: File
  onProgress?: (ratio: number) => void
}): Promise<void> {
  const endpoint = `${storageHostname(input.projectUrl)}/storage/v1/upload/resumable`

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(input.file, {
      endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: input.bucket,
        objectName: input.path,
        contentType: input.file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      chunkSize: TUS_CHUNK_SIZE,
      onError: (error) => reject(error),
      onProgress: (bytesUploaded, bytesTotal) => {
        if (bytesTotal > 0 && input.onProgress) {
          input.onProgress(bytesUploaded / bytesTotal)
        }
      },
      onSuccess: () => resolve(),
    })

    void upload.findPreviousUploads().then((previous) => {
      if (previous.length > 0) {
        upload.resumeFromPreviousUpload(previous[0]!)
      }
      upload.start()
    })
  })
}

async function createIngestRun(
  supabase: SupabaseClient,
  userId: string,
  clientRunId: string,
  stats: Record<string, unknown>
): Promise<string> {
  const { data, error } = await supabase
    .from("ingest_runs")
    .insert({
      user_id: userId,
      trigger: "user_upload",
      status: "queued",
      client_run_id: clientRunId,
      started_at: new Date().toISOString(),
      stats,
    })
    .select("id")
    .single()

  if (error) throw new Error(error.message)
  return String(data.id)
}

async function findExistingByChecksum(
  supabase: SupabaseClient,
  userId: string,
  checksum: string,
  purpose: string
): Promise<UserFileRow | null> {
  const { data, error } = await supabase
    .from("user_files")
    .select("*")
    .eq("user_id", userId)
    .eq("checksum", checksum)
    .eq("purpose", purpose)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapUserFile(data as Record<string, unknown>)
}

/**
 * Upload a document directly to private Storage and record user_files + ingest_runs.
 * Idempotent on (user_id, checksum) when a prior active file exists.
 */
export async function uploadIngestDocument(input: {
  supabase: SupabaseClient
  file: File
  spec: IngestUploadSpec
  onProgress?: (ratio: number) => void
}): Promise<IngestUploadResult> {
  const { supabase, file, spec, onProgress } = input
  assertAccepted(file, spec)

  const { userId, accessToken } = await ensureProfileBeforeIngest(supabase)

  const checksum = await sha256Hex(file)
  const uploadAttemptId = crypto.randomUUID()
  const clientRunId = `upload:${checksum.slice(0, 16)}:${uploadAttemptId}`

  const existing = await findExistingByChecksum(
    supabase,
    userId,
    checksum,
    spec.purpose
  )

  if (existing) {
    const ingestRunId = await createIngestRun(supabase, userId, clientRunId, {
      document_kind: spec.documentKind,
      file_id: existing.id,
      reused_existing: true,
      original_filename: file.name,
      byte_size: file.size,
      checksum,
    })

    await supabase
      .from("user_files")
      .update({
        metadata: {
          ...(existing.metadata ?? {}),
          last_ingest_run_id: ingestRunId,
          document_kind: spec.documentKind,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)

    onProgress?.(1)
    return {
      file: existing,
      ingestRunId,
      reusedExisting: true,
      storagePath: existing.storage_path,
    }
  }

  const objectId = crypto.randomUUID()
  const storagePath = buildStorageObjectPath(userId, file.name, objectId)
  const { url: projectUrl } = getSupabaseEnv()
  if (!projectUrl) {
    throw new Error("Supabase is not configured.")
  }

  // Create the job row before bytes leave the browser (audit lineage).
  const ingestRunId = await createIngestRun(supabase, userId, clientRunId, {
    document_kind: spec.documentKind,
    original_filename: file.name,
    byte_size: file.size,
    checksum,
    storage_bucket: spec.bucket,
    storage_path: storagePath,
  })

  try {
    if (file.size >= RESUMABLE_THRESHOLD_BYTES) {
      await uploadViaTus({
        accessToken,
        projectUrl,
        bucket: spec.bucket,
        path: storagePath,
        file,
        onProgress,
      })
    } else {
      onProgress?.(0.15)
      await uploadViaStandardApi(supabase, spec.bucket, storagePath, file)
      onProgress?.(0.9)
    }
  } catch (error) {
    await supabase
      .from("ingest_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_summary:
          error instanceof Error ? error.message : "Storage upload failed",
      })
      .eq("id", ingestRunId)
    throw error
  }

  const { data: fileRow, error: insertError } = await supabase
    .from("user_files")
    .insert({
      id: objectId,
      user_id: userId,
      purpose: spec.purpose,
      storage_bucket: spec.bucket,
      storage_path: storagePath,
      mime_type: file.type || "application/octet-stream",
      byte_size: file.size,
      checksum,
      original_filename: file.name,
      metadata: {
        document_kind: spec.documentKind,
        ingest_run_id: ingestRunId,
        uploaded_at: new Date().toISOString(),
      },
    })
    .select("*")
    .single()

  if (insertError) {
    await supabase
      .from("ingest_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_summary: insertError.message,
      })
      .eq("id", ingestRunId)
    await supabase.storage.from(spec.bucket).remove([storagePath])
    throw new Error(insertError.message)
  }

  await supabase
    .from("ingest_runs")
    .update({
      status: "running",
      stats: {
        document_kind: spec.documentKind,
        file_id: fileRow.id,
        original_filename: file.name,
        byte_size: file.size,
        checksum,
        storage_bucket: spec.bucket,
        storage_path: storagePath,
      },
    })
    .eq("id", ingestRunId)

  onProgress?.(1)

  return {
    file: mapUserFile(fileRow as Record<string, unknown>),
    ingestRunId,
    reusedExisting: false,
    storagePath,
  }
}
