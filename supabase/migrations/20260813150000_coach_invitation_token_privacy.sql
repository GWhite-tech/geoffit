-- =============================================================================
-- Coach invitation token privacy
--
-- Authenticated roles must not SELECT token_hash via PostgREST.
-- PostgreSQL table-level SELECT covers all columns, so a column-only REVOKE is
-- insufficient: revoke table SELECT, then grant SELECT on safe columns only.
--
-- Client INSERT of token_hash on create is preserved.
-- accept_coach_invitation() is SECURITY DEFINER (owner) and still reads the hash.
-- Safe invitation columns remain selectable under existing RLS policies.
-- =============================================================================

-- Remove table-wide SELECT (which previously exposed token_hash).
revoke select on table public.coach_invitations from authenticated;

-- Drop any prior column SELECT grant on the secret (idempotent / local re-apply).
revoke select (token_hash) on table public.coach_invitations from authenticated;

-- Safe invitation fields only (no token_hash).
grant select (
  id,
  client_user_id,
  coach_email,
  coach_user_id,
  status,
  permissions,
  expires_at,
  accepted_at,
  revoked_at,
  created_at,
  updated_at
) on table public.coach_invitations to authenticated;

-- Client create path inserts token_hash; RETURNING uses only safe columns.
grant insert on table public.coach_invitations to authenticated;
grant insert (token_hash) on table public.coach_invitations to authenticated;

comment on column public.coach_invitations.token_hash is
  'SHA-256 digest of the raw invitation token. Not selectable by authenticated; written on client INSERT; read only by SECURITY DEFINER accept path.';
