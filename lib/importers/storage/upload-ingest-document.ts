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

function decodeUploadMetadataHeader(
  header: string | undefined
): Record<string, string> {
  if (!header) return {}
  const decoded: Record<string, string> = {}
  for (const part of header.split(",")) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const space = trimmed.indexOf(" ")
    if (space <= 0) continue
    const key = trimmed.slice(0, space)
    const b64 = trimmed.slice(space + 1)
    try {
      decoded[key] = atob(b64)
    } catch {
      decoded[key] = b64
    }
  }
  return decoded
}

function redactAuthorization(value: string | null | undefined): string | null {
  if (value == null || value === "") return null
  const match = /^Bearer\s+(.+)$/i.exec(value.trim())
  if (!match) return "[redacted]"
  const token = match[1]
  const suffix = token.length <= 8 ? "…" : token.slice(-4)
  return `Bearer [redacted len=${token.length} …${suffix}]`
}

function bodyByteLength(body: unknown): number | null {
  if (body == null) return null
  if (typeof Blob !== "undefined" && body instanceof Blob) return body.size
  if (body instanceof ArrayBuffer) return body.byteLength
  if (ArrayBuffer.isView(body)) return body.byteLength
  if (typeof body === "string") return body.length
  return null
}

function collectResponseHeaders(
  res: tus.HttpResponse
): Record<string, string> {
  const xhr = res.getUnderlyingObject() as XMLHttpRequest | undefined
  const raw =
    typeof xhr?.getAllResponseHeaders === "function"
      ? xhr.getAllResponseHeaders()
      : ""
  const headers: Record<string, string> = {}
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const idx = line.indexOf(":")
    if (idx <= 0) continue
    headers[line.slice(0, idx).trim().toLowerCase()] = line
      .slice(idx + 1)
      .trim()
  }
  for (const name of [
    "upload-offset",
    "upload-length",
    "tus-resumable",
    "location",
    "content-type",
    "sb-request-id",
    "x-request-id",
    "x-sb-error",
    "x-error-code",
    "x-error-message",
  ]) {
    const value = res.getHeader(name)
    if (value != null && value !== "") headers[name] = value
  }
  return headers
}

function logTusHttpExchange(input: {
  event: "tus_request" | "tus_response" | "tus_error"
  requestOrdinal: number
  method: string | null
  url: string | null
  projectUrl: string
  bucket: string
  endpoint: string
  fileName: string
  fileType: string
  fileSizeBytes: number
  chunkSize: number
  uploadDataDuringCreation: boolean
  metadata: Record<string, string>
  headers: Record<string, string | null>
  contentLength: number | null
  uploadMetadataDecoded: Record<string, string>
  status?: number | null
  responseHeaders?: Record<string, string> | null
  responseBody?: string | null
  message?: string | null
}): void {
  const uploadLengthRaw = input.headers["Upload-Length"] ?? null
  const uploadLengthNumber =
    uploadLengthRaw != null && uploadLengthRaw !== ""
      ? Number(uploadLengthRaw)
      : null
  const bucketName = input.uploadMetadataDecoded.bucketName ?? null

  const payload = {
    scope: "storage-tus-upload",
    event: input.event,
    requestOrdinal: input.requestOrdinal,
    method: input.method,
    url: input.url,
    bucket: input.bucket,
    endpoint: input.endpoint,
    projectUrl: input.projectUrl,
    fileName: input.fileName,
    fileType: input.fileType,
    fileSizeBytes: input.fileSizeBytes,
    chunkSize: input.chunkSize,
    uploadDataDuringCreation: input.uploadDataDuringCreation,
    metadata: input.metadata,
    headers: {
      "Upload-Length": uploadLengthRaw,
      "Tus-Resumable": input.headers["Tus-Resumable"] ?? null,
      "Upload-Metadata": input.headers["Upload-Metadata"] ?? null,
      "Upload-Offset": input.headers["Upload-Offset"] ?? null,
      "Content-Type": input.headers["Content-Type"] ?? null,
      "Content-Length":
        input.contentLength == null ? null : String(input.contentLength),
      Authorization: redactAuthorization(input.headers.Authorization),
      "x-upsert": input.headers["x-upsert"] ?? null,
    },
    "Upload-Metadata-decoded": input.uploadMetadataDecoded,
    verify: {
      uploadLengthEqualsFileSize:
        uploadLengthNumber === null
          ? null
          : uploadLengthNumber === input.fileSizeBytes,
      bucketNameEqualsRawIngest: bucketName === "raw-ingest",
      bucketName,
    },
    status: input.status ?? null,
    responseHeaders: input.responseHeaders ?? null,
    responseBody: input.responseBody ?? null,
    requestId:
      input.responseHeaders?.["sb-request-id"] ??
      input.responseHeaders?.["x-request-id"] ??
      null,
    "x-request-id": input.responseHeaders?.["x-request-id"] ?? null,
    "x-sb-error": input.responseHeaders?.["x-sb-error"] ?? null,
    message: input.message ?? null,
  }

  if (input.event === "tus_error") {
    console.error(JSON.stringify(payload))
  } else {
    console.info(JSON.stringify(payload))
  }
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
  const uploadDataDuringCreation = true
  const fileType = input.file.type || "application/octet-stream"
  const metadata = {
    bucketName: input.bucket,
    objectName: input.path,
    contentType: fileType,
    cacheControl: "3600",
  }
  const staticHeaders = {
    authorization: `Bearer ${input.accessToken}`,
    "x-upsert": "false",
  }

  // STEP 1 — exact runtime config immediately before creating the TUS upload
  console.info(
    JSON.stringify({
      scope: "storage-tus-upload",
      event: "tus_upload_planned",
      bucket: input.bucket,
      endpoint,
      projectUrl: input.projectUrl,
      fileName: input.file.name,
      fileType,
      fileSizeBytes: input.file.size,
      chunkSize: TUS_CHUNK_SIZE,
      uploadDataDuringCreation,
      metadata,
      headers: {
        authorization: redactAuthorization(staticHeaders.authorization),
        "x-upsert": staticHeaders["x-upsert"],
      },
    })
  )

  await new Promise<void>((resolve, reject) => {
    let requestOrdinal = 0
    const upload = new tus.Upload(input.file, {
      endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: staticHeaders,
      uploadDataDuringCreation,
      removeFingerprintOnSuccess: true,
      metadata,
      chunkSize: TUS_CHUNK_SIZE,
      onBeforeRequest: (req) => {
        requestOrdinal += 1
        const ordinal = requestOrdinal
        const xhr = req.getUnderlyingObject() as XMLHttpRequest | undefined
        const originalSend = xhr?.send?.bind(xhr)

        const logRequest = (contentLength: number | null) => {
          logTusHttpExchange({
            event: "tus_request",
            requestOrdinal: ordinal,
            method: req.getMethod(),
            url: req.getURL(),
            projectUrl: input.projectUrl,
            bucket: input.bucket,
            endpoint,
            fileName: input.file.name,
            fileType,
            fileSizeBytes: input.file.size,
            chunkSize: TUS_CHUNK_SIZE,
            uploadDataDuringCreation,
            metadata,
            headers: {
              "Upload-Length": req.getHeader("Upload-Length") ?? null,
              "Tus-Resumable": req.getHeader("Tus-Resumable") ?? null,
              "Upload-Metadata": req.getHeader("Upload-Metadata") ?? null,
              "Upload-Offset": req.getHeader("Upload-Offset") ?? null,
              "Content-Type": req.getHeader("Content-Type") ?? null,
              Authorization:
                req.getHeader("Authorization") ??
                req.getHeader("authorization") ??
                staticHeaders.authorization,
              "x-upsert":
                req.getHeader("x-upsert") ?? staticHeaders["x-upsert"],
            },
            contentLength,
            uploadMetadataDecoded: decodeUploadMetadataHeader(
              req.getHeader("Upload-Metadata")
            ),
          })
        }

        // Intercept immediately before the request leaves the browser so we
        // can observe Content-Length of the body (set by the browser on send).
        if (xhr && originalSend) {
          xhr.send = ((body?: Document | XMLHttpRequestBodyInit | null) => {
            logRequest(bodyByteLength(body ?? null))
            return originalSend(body as XMLHttpRequestBodyInit | Document | null)
          }) as typeof xhr.send
        } else {
          logRequest(null)
        }
      },
      onAfterResponse: (req, res) => {
        const responseHeaders = collectResponseHeaders(res)
        logTusHttpExchange({
          event: "tus_response",
          requestOrdinal,
          method: req.getMethod(),
          url: req.getURL(),
          projectUrl: input.projectUrl,
          bucket: input.bucket,
          endpoint,
          fileName: input.file.name,
          fileType,
          fileSizeBytes: input.file.size,
          chunkSize: TUS_CHUNK_SIZE,
          uploadDataDuringCreation,
          metadata,
          headers: {
            "Upload-Length": req.getHeader("Upload-Length") ?? null,
            "Tus-Resumable": req.getHeader("Tus-Resumable") ?? null,
            "Upload-Metadata": req.getHeader("Upload-Metadata") ?? null,
            "Upload-Offset": req.getHeader("Upload-Offset") ?? null,
            "Content-Type": req.getHeader("Content-Type") ?? null,
            Authorization:
              req.getHeader("Authorization") ??
              req.getHeader("authorization") ??
              staticHeaders.authorization,
            "x-upsert":
              req.getHeader("x-upsert") ?? staticHeaders["x-upsert"],
          },
          contentLength: null,
          uploadMetadataDecoded: decodeUploadMetadataHeader(
            req.getHeader("Upload-Metadata")
          ),
          status: res.getStatus(),
          responseHeaders,
          responseBody: res.getBody(),
        })
      },
      onShouldRetry: (error, retryAttempt) => {
        const status = error.originalResponse?.getStatus()
        console.info(
          JSON.stringify({
            scope: "storage-tus-upload",
            event: "tus_retry_decision",
            status: status ?? null,
            retryAttempt,
            willRetry: status !== 413 && retryAttempt < 5,
            message: error.message,
          })
        )
        if (status === 413) return false
        return retryAttempt < 5
      },
      onError: (error) => {
        const detailed = error instanceof tus.DetailedError ? error : null
        const res = detailed?.originalResponse ?? null
        const req = detailed?.originalRequest ?? null
        const responseHeaders = res ? collectResponseHeaders(res) : null
        logTusHttpExchange({
          event: "tus_error",
          requestOrdinal,
          method: req?.getMethod() ?? null,
          url: req?.getURL() ?? null,
          projectUrl: input.projectUrl,
          bucket: input.bucket,
          endpoint,
          fileName: input.file.name,
          fileType,
          fileSizeBytes: input.file.size,
          chunkSize: TUS_CHUNK_SIZE,
          uploadDataDuringCreation,
          metadata,
          headers: {
            "Upload-Length": req?.getHeader("Upload-Length") ?? null,
            "Tus-Resumable": req?.getHeader("Tus-Resumable") ?? null,
            "Upload-Metadata": req?.getHeader("Upload-Metadata") ?? null,
            "Upload-Offset": req?.getHeader("Upload-Offset") ?? null,
            "Content-Type": req?.getHeader("Content-Type") ?? null,
            Authorization:
              req?.getHeader("Authorization") ??
              req?.getHeader("authorization") ??
              staticHeaders.authorization,
            "x-upsert":
              req?.getHeader("x-upsert") ?? staticHeaders["x-upsert"],
          },
          contentLength: null,
          uploadMetadataDecoded: decodeUploadMetadataHeader(
            req?.getHeader("Upload-Metadata")
          ),
          status: res?.getStatus() ?? null,
          responseHeaders,
          responseBody: res?.getBody() ?? null,
          message: error instanceof Error ? error.message : String(error),
        })
        reject(error)
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        if (bytesTotal > 0 && input.onProgress) {
          input.onProgress(bytesUploaded / bytesTotal)
        }
      },
      onSuccess: () => resolve(),
    })

    void upload.findPreviousUploads().then((previous) => {
      const prior = previous[0]
      if (prior) {
        upload.resumeFromPreviousUpload(prior)
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
    console.info(
      JSON.stringify({
        scope: "storage-tus-upload",
        event: "upload_path_selected",
        bucket: spec.bucket,
        documentKind: spec.documentKind,
        fileName: file.name,
        fileSizeBytes: file.size,
        resumableThresholdBytes: RESUMABLE_THRESHOLD_BYTES,
        useTus: file.size >= RESUMABLE_THRESHOLD_BYTES,
        chunkSize: TUS_CHUNK_SIZE,
        objectPath: storagePath,
        targetsRawIngestBucket: spec.bucket === "raw-ingest",
      })
    )
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
