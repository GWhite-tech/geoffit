# Direct Storage ingest uploads

**Status:** Production path for blood lab PDFs  
**Problem solved:** Vercel `FUNCTION_PAYLOAD_TOO_LARGE` (413) when multipart PDF bodies hit `/api/import/blood-test`

## Why the 413 happened

```text
ImportCentre
  → uploadImportFiles("blood-test", [pdf])
    → fetch POST /api/import/blood-test  (FormData with full PDF bytes)
      → Vercel Serverless Function request body (~4.5 MB limit)
        → FUNCTION_PAYLOAD_TOO_LARGE  (5.6 MB PDF never reached route logic)
```

The Route Handler’s own `MAX_BYTES = 25MB` never ran — the platform rejected the request first.

## Production pipeline

Generic spine (all document kinds) — see [`document-ingestion-framework.md`](./document-ingestion-framework.md):

```text
Browser
  1. SHA-256 checksum (idempotency)
  2. Insert ingest_runs (queued) + upload bytes → private Storage
  3. Insert user_files metadata
  4. POST /api/ingest/process  JSON { documentKind, fileId, ingestRunId }
Server
  5. DocumentParser (registered by kind)
  6. FactWriter + TimelineWriter (stubs → Phase 2)
  7. Update ingest_runs → return preview API shape
```

Blood PDF remains available at `/api/import/blood-test` as a thin alias.

## Buckets

| Bucket | Purpose | Limit |
|--------|---------|-------|
| `lab-pdfs` | Blood / DEXA / lab PDFs | 100 MB |
| `raw-ingest` | Apple Health ZIP/XML, CSV dumps | 500 MB |

Path: `{user_id}/{yyyy}/{mm}/{uuid}.ext` — Storage RLS requires folder[1] = `auth.uid()`.

## Future sources

Reuse `uploadIngestDocument` + specs in `lib/importers/storage/types.ts`:

- `BLOOD_LAB_PDF_UPLOAD`
- `DEXA_PDF_UPLOAD`
- `APPLE_HEALTH_UPLOAD`

## Apply

```bash
supabase db push
# includes 20260806120000_user_files_and_storage.sql
```
