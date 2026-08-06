-- =============================================================================
-- Geoffit — user_files + private Storage buckets (ingest/lab documents)
-- Supports blood PDFs now; Apple Health ZIPs / DEXA / misc via purpose + bucket.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- user_files
-- -----------------------------------------------------------------------------

create table public.user_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  purpose text not null
    check (
      purpose in (
        'avatar',
        'raw_ingest',
        'lab_pdf',
        'progress_photo',
        'report_pdf',
        'journal',
        'misc'
      )
    ),
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  checksum text,
  original_filename text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  revision bigint not null default 1 check (revision >= 1),
  constraint user_files_storage_unique unique (storage_bucket, storage_path),
  constraint user_files_bucket_nonempty check (length(trim(storage_bucket)) > 0),
  constraint user_files_path_nonempty check (length(trim(storage_path)) > 0),
  constraint user_files_mime_nonempty check (length(trim(mime_type)) > 0)
);

comment on table public.user_files is
  'PLATFORM — Metadata for blobs in private Storage (lab PDFs, raw ingest, photos, …).';
comment on column public.user_files.purpose is
  'Logical role of the file (maps to bucket conventions).';
comment on column public.user_files.storage_bucket is
  'Supabase Storage bucket id, e.g. lab-pdfs or raw-ingest.';
comment on column public.user_files.storage_path is
  'Object path within the bucket: {user_id}/{yyyy}/{mm}/{uuid}.ext';
comment on column public.user_files.checksum is
  'SHA-256 hex of file bytes for idempotent re-uploads.';
comment on column public.user_files.original_filename is
  'Client-supplied filename at upload time.';
comment on column public.user_files.metadata is
  'Extra JSON (ingest_run_id, document_kind, pages, …).';
comment on column public.user_files.byte_size is
  'Object size in bytes.';
comment on column public.user_files.created_at is
  'uploaded_at — insert time (UTC).';

create unique index user_files_user_checksum_active_uq
  on public.user_files (user_id, checksum)
  where checksum is not null and deleted_at is null;

create index user_files_user_purpose_idx
  on public.user_files (user_id, purpose)
  where deleted_at is null;

create index user_files_user_created_idx
  on public.user_files (user_id, created_at desc)
  where deleted_at is null;

create trigger user_files_set_updated_at
  before update on public.user_files
  for each row execute function public.set_updated_at();

alter table public.user_files enable row level security;
alter table public.user_files force row level security;

create policy user_files_select_own
  on public.user_files for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);

create policy user_files_insert_own
  on public.user_files for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy user_files_update_own
  on public.user_files for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy user_files_delete_own
  on public.user_files for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.user_files from public, anon;
grant select, insert, update, delete on public.user_files to authenticated;

-- -----------------------------------------------------------------------------
-- Storage buckets (private)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'lab-pdfs',
    'lab-pdfs',
    false,
    104857600, -- 100 MB
    array['application/pdf']::text[]
  ),
  (
    'raw-ingest',
    'raw-ingest',
    false,
    524288000, -- 500 MB (Apple Health ZIPs, large dumps)
    array[
      'application/zip',
      'application/x-zip-compressed',
      'application/xml',
      'text/xml',
      'text/csv',
      'application/pdf',
      'application/octet-stream'
    ]::text[]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: {user_id}/... — first folder must equal auth.uid()

create policy lab_pdfs_select_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'lab-pdfs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy lab_pdfs_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'lab-pdfs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy lab_pdfs_update_own
  on storage.objects for update to authenticated
  using (
    bucket_id = 'lab-pdfs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'lab-pdfs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy lab_pdfs_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'lab-pdfs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy raw_ingest_select_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'raw-ingest'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy raw_ingest_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'raw-ingest'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy raw_ingest_update_own
  on storage.objects for update to authenticated
  using (
    bucket_id = 'raw-ingest'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'raw-ingest'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy raw_ingest_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'raw-ingest'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
