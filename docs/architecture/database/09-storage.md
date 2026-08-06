# Geoffit Database Architecture — Storage

Object storage (Supabase Storage) is for blobs. Relational tables hold metadata and pointers (`user_files`, `raw_payloads`, `progress_photos`, `report_exports`).

## Buckets (logical)

| Bucket | Contents | Access |
|--------|----------|--------|
| `raw-ingest` | Apple Health exports, CSV, API dumps | Private; owner only |
| `lab-pdfs` | Blood panel PDFs | Private |
| `progress-photos` | Progress photo originals (+ optional derivatives) | Private |
| `report-pdfs` | Generated report PDFs | Private |
| `user-misc` | Journal attachments, misc uploads | Private |
| `avatars` | Profile images | Private or signed public |

No public anonymous clinical media.

## Path convention

```text
{bucket}/{user_id}/{yyyy}/{mm}/{uuid}.{ext}
```

Always scope first path segment to `user_id` for RLS/Storage policies.

## Metadata tables

| Concern | Table fields |
|---------|--------------|
| Generic file | `user_files`: purpose, mime, size, checksum, storage_path |
| Ingest blob | `raw_payloads.storage_path` + fingerprint |
| Photo | `progress_photos.storage_path` + pose/metadata |
| Report PDF | `report_exports.storage_path` + `reports` pointer |
| AI embeddings | Vectors in DB (pgvector); not Storage |

## Lifecycle

| Class | Retention |
|-------|-----------|
| raw-ingest | Keep until ingest success + retention policy (e.g. 90d) or user delete |
| lab-pdfs | User-owned; soft-delete then GC |
| progress-photos | User-owned; derivatives regenerable |
| report-pdfs | Regenerable; may expire after N days if source facts remain |
| avatars | Replace in place |

## Thumbnails & AI derivatives

- Photo thumbnails: same bucket, suffix `_thumb` or separate `progress-photos-derived`  
- AI comparison overlays: DERIVED; regenerable; optional Storage  
- Body-comp estimation outputs: DERIVED artifacts, never overwrite photo facts  

## Sync with local

- Mobile/web may cache signed URLs short-lived  
- Offline: enqueue upload in `offline_queue` with local blob ref; promote to Storage on reconnect  

## Security notes

- Short-TTL signed URLs only  
- Virus/malware scan on ingest uploads (future)  
- Never put OAuth tokens in Storage  
