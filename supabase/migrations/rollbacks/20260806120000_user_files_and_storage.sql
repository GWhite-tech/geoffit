-- Rollback: user_files + storage buckets/policies

drop policy if exists raw_ingest_delete_own on storage.objects;
drop policy if exists raw_ingest_update_own on storage.objects;
drop policy if exists raw_ingest_insert_own on storage.objects;
drop policy if exists raw_ingest_select_own on storage.objects;

drop policy if exists lab_pdfs_delete_own on storage.objects;
drop policy if exists lab_pdfs_update_own on storage.objects;
drop policy if exists lab_pdfs_insert_own on storage.objects;
drop policy if exists lab_pdfs_select_own on storage.objects;

delete from storage.objects where bucket_id in ('lab-pdfs', 'raw-ingest');
delete from storage.buckets where id in ('lab-pdfs', 'raw-ingest');

drop policy if exists user_files_delete_own on public.user_files;
drop policy if exists user_files_update_own on public.user_files;
drop policy if exists user_files_insert_own on public.user_files;
drop policy if exists user_files_select_own on public.user_files;
drop table if exists public.user_files cascade;
