-- =============================================================================
-- Fix: accepting an expired invitation must not leave status='pending'.
-- PL/pgSQL RAISE rolls back in-function UPDATEs, so expiry is committed via a
-- separate SECURITY DEFINER function that callers invoke first (and accept
-- also calls before validation — when accept raises, a prior committed expire
-- is impossible inside one function). Solution: expire_stale commits only when
-- called as its own statement; accept treats expired rows as errors without
-- updating; create/accept app paths call expire_stale first.
-- Additionally: accept marks expired using a non-raising path is insufficient
-- alone, so we change accept to call expire_stale logic via dblink-less pattern:
-- use UPDATE ... RETURNING in accept ONLY when we return successfully path.
-- For expired tokens: rely on expire_stale_coach_invitations() as a separate RPC.
-- =============================================================================

create or replace function public.expire_stale_coach_invitations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.coach_invitations
  set status = 'expired', updated_at = now()
  where status = 'pending'
    and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.expire_stale_coach_invitations() is
  'Marks pending invitations with expires_at <= now() as expired. Call in its own request before create/accept.';

revoke all on function public.expire_stale_coach_invitations() from public;
grant execute on function public.expire_stale_coach_invitations() to authenticated;

create or replace function public.accept_coach_invitation(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_inv public.coach_invitations%rowtype;
  v_rel_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_token_hash is null or length(trim(p_token_hash)) = 0 then
    raise exception 'invalid invitation' using errcode = '22023';
  end if;
  if v_email = '' then
    raise exception 'invalid invitation' using errcode = '22023';
  end if;

  -- Expire stale rows first. When this function later raises, these updates
  -- roll back too — callers MUST also invoke expire_stale_coach_invitations()
  -- as a separate statement. Kept here as best-effort for same-request races.
  update public.coach_invitations
  set status = 'expired', updated_at = now()
  where status = 'pending'
    and expires_at <= now()
    and token_hash <> p_token_hash;

  select * into v_inv
  from public.coach_invitations
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'invalid invitation' using errcode = '22023';
  end if;

  if v_inv.status = 'expired' or v_inv.expires_at <= now() then
    -- Do not UPDATE+RAISE (would roll back). Require prior expire_stale call
    -- for persistence; still reject acceptance.
    raise exception 'invitation expired' using errcode = '22023';
  end if;

  if v_inv.status <> 'pending' then
    raise exception 'invitation not pending' using errcode = '22023';
  end if;

  if v_inv.coach_email <> v_email then
    raise exception 'invalid invitation' using errcode = '22023';
  end if;

  if v_inv.client_user_id = v_uid then
    raise exception 'invalid invitation' using errcode = '22023';
  end if;

  select id into v_rel_id
  from public.coach_client_relationships
  where coach_user_id = v_uid
    and client_user_id = v_inv.client_user_id
    and status = 'active'
  limit 1
  for update;

  if v_rel_id is not null then
    update public.coach_client_relationships
    set
      permissions = v_inv.permissions,
      invitation_id = v_inv.id,
      accepted_at = coalesce(accepted_at, now()),
      updated_at = now()
    where id = v_rel_id;
  else
    select id into v_rel_id
    from public.coach_client_relationships
    where coach_user_id = v_uid
      and client_user_id = v_inv.client_user_id
      and status = 'revoked'
    order by revoked_at desc nulls last, created_at desc
    limit 1
    for update;

    if v_rel_id is not null then
      update public.coach_client_relationships
      set
        status = 'active',
        permissions = v_inv.permissions,
        invitation_id = v_inv.id,
        accepted_at = now(),
        revoked_at = null,
        updated_at = now()
      where id = v_rel_id;
    else
      insert into public.coach_client_relationships (
        coach_user_id,
        client_user_id,
        status,
        permissions,
        invitation_id,
        accepted_at
      ) values (
        v_uid,
        v_inv.client_user_id,
        'active',
        v_inv.permissions,
        v_inv.id,
        now()
      )
      returning id into v_rel_id;
    end if;
  end if;

  update public.coach_invitations
  set
    status = 'accepted',
    coach_user_id = v_uid,
    accepted_at = now(),
    updated_at = now()
  where id = v_inv.id;

  return v_rel_id;
end;
$$;
