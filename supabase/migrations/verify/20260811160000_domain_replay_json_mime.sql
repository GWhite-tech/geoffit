-- Verify domain-replay JSON MIME allowlist on lab-pdfs + raw-ingest.
-- Expect 0 rows.

with failures as (
  select 'lab_pdfs_missing_application_json'::text as check_name, ''::text as detail
  where not exists (
    select 1
    from storage.buckets
    where id = 'lab-pdfs'
      and allowed_mime_types is not null
      and 'application/json' = any (allowed_mime_types)
  )
  union all
  select 'lab_pdfs_missing_application_pdf', ''
  where not exists (
    select 1
    from storage.buckets
    where id = 'lab-pdfs'
      and allowed_mime_types is not null
      and 'application/pdf' = any (allowed_mime_types)
  )
  union all
  select 'raw_ingest_missing_application_json', ''
  where not exists (
    select 1
    from storage.buckets
    where id = 'raw-ingest'
      and allowed_mime_types is not null
      and 'application/json' = any (allowed_mime_types)
  )
  union all
  select 'raw_ingest_missing_prior_mime', m
  from unnest(
    array[
      'application/zip',
      'application/x-zip-compressed',
      'application/xml',
      'text/xml',
      'text/csv',
      'application/pdf',
      'application/octet-stream'
    ]::text[]
  ) as m
  where not exists (
    select 1
    from storage.buckets
    where id = 'raw-ingest'
      and allowed_mime_types is not null
      and m = any (allowed_mime_types)
  )
)
select * from failures;
