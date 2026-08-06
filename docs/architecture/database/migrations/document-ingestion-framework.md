# Document Ingestion Framework

**Status:** Implemented (app spine)  
**Module:** `lib/ingestion/`  
**API:** `POST /api/ingest/process`

## Spine

```text
Browser upload (direct Storage)
  → user_files          (blob metadata + checksum)
  → ingest_runs         (job row; queued → running → succeeded|failed)
  → DocumentParser      (pluggable by DocumentKind)
  → FactWriter          (canonical health tables — stubbed until Phase 2)
  → TimelineWriter      (timeline_entries — stubbed)
  → ingest_runs complete
```

Every document type (blood PDF, Apple Health ZIP, DEXA, progress photo, ECG, …) follows this path. Upload logic is shared; only parsers differ.

## Registering a parser

```ts
// lib/ingestion/parsers/my-kind.ts
export const myParser: DocumentParser = {
  id: "parser.my_kind",
  kind: "medical_document",
  label: "…",
  uploadSpec: MY_UPLOAD_SPEC, // or null
  execution: "inline" | "background",
  maxAttempts: 3,
  async parse(ctx) { /* use ctx.bytes — never re-upload */ },
}

// lib/ingestion/parsers/register-all.ts
registerDocumentParser(myParser)
```

Do **not** duplicate Storage upload code. Use `uploadIngestDocument` / `startDocumentIngest`.

## Idempotency & retries

| Layer | Mechanism |
|-------|-----------|
| Upload | SHA-256 → reuse `user_files` row when checksum matches |
| Job | Unique `ingest_runs.client_run_id` per attempt |
| Parse | `contentFingerprint` stored on run stats |
| Retry | `POST /api/ingest/process` with `{ retry: true }` increments `attempt` up to `maxAttempts` |

## Background execution

- `execution: "background"` — hint for large jobs (Apple Health).
- `enqueueOnly: true` — marks run `queued` without parsing; a worker (or later cron) calls `/api/ingest/process` without `enqueueOnly`.
- Inline process remains the default for Import Centre preview UX.

## Client entry

```ts
await startDocumentIngest({
  supabase,
  file,
  uploadSpec: BLOOD_LAB_PDF_UPLOAD,
  documentKind: "blood_lab_pdf",
})
// → Storage upload + process → ImportApiResponse-shaped preview
```

`uploadImportFiles` in `lib/importers/client-upload.ts` routes blood / Apple Health / Hevy / CSV through this spine. Screenshots still use multipart until multi-file Storage batch lands.

## Writers

| Writer | Today | Next |
|--------|-------|------|
| `deferredClientFactWriter` | Skips DB; confirm uses client stores | Supabase FACT upserts by fingerprint |
| `noopTimelineWriter` | No-op | `timeline_entries` projection |

## Related

- Storage upload details: [`storage-ingest-uploads.md`](./storage-ingest-uploads.md)
- Event flow: [`../13-event-flow.md`](../13-event-flow.md)
- Preference vs ingest ownership: unrelated — see `28-preference-ownership.md`
