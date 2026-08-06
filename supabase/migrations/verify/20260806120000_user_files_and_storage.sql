-- Verify user_files + private storage buckets

with failures as (
  select 'user_files_missing'::text as check_name, ''::text as detail
  where not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_files'
  )
  union all
  select 'user_files_rls_off', 'user_files'
  where exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'user_files' and not c.relrowsecurity
  )
  union all
  select 'bucket_missing', b
  from (values ('lab-pdfs'), ('raw-ingest')) as v(b)
  where not exists (select 1 from storage.buckets where id = v.b)
  union all
  select 'user_files_still_has_no_checksum_uq', 'user_files_user_checksum_active_uq'
  where not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'user_files_user_checksum_active_uq'
  )
)
select * from failures;

-- Expect 0 rows.
