-- Rollback: remove application/json from domain-replay ingest buckets only.
-- Preserves all other allowed MIME types.

update storage.buckets
set allowed_mime_types = array_remove(allowed_mime_types, 'application/json')
where id in ('lab-pdfs', 'raw-ingest')
  and allowed_mime_types is not null
  and 'application/json' = any (allowed_mime_types);
