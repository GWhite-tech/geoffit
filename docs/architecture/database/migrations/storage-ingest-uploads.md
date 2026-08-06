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

```text
Browser
  1. SHA-256 checksum (idempotency)
  2. Insert ingest_runs (queued) + upload bytes → private Storage (lab-pdfs)
     • < 6 MB: supabase.storage.upload
     • ≥ 6 MB: TUS resumable (tus-js-client → *.storage.supabase.co)
  3. Insert user_files metadata (user_id, filename, size, checksum, uploaded_at)
  4. POST /api/import/blood-test  JSON { fileId, ingestRunId }  ← tiny payload
Server
  5. Auth + ownership check on user_files
  6. Download PDF from Storage (user-scoped client)
  7. Existing BloodTestImporter / parseBloodTestPdfOnServer
  8. Update ingest_runs status → return same preview API shape
```

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
