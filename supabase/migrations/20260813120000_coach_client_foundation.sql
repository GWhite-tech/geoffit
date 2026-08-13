-- =============================================================================
-- Geoffit Phase 1 — Coach / Client security foundation
-- Tables: coach_invitations, coach_client_relationships
-- Helper: can_coach_read / coach_category_for_metric / coach_visible_client_profile
-- RLS: SELECT-only coach access to granted categories on existing fact tables
-- Does NOT duplicate health data. Does NOT weaken owner policies.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permission categories (constrained vocabulary)
-- -----------------------------------------------------------------------------

create or replace function public.is_coach_permission_category(p_category text)
returns boolean
language sql
immutable
as $$
  select p_category in (
    'vitals',
    'sleep',
    'body',
    'nutrition',
    'training',
    'blood',
    'treatments'
  );
$$;

comment on function public.is_coach_permission_category(text) is
  'True when category is one of the Phase 1 coach permission vocabulary.';

create or replace function public.coach_permissions_valid(p_permissions text[])
returns boolean
language sql
immutable
as $$
  select
    p_permissions is not null
    and cardinality(p_permissions) > 0
    and not exists (
      select 1
      from unnest(p_permissions) as cat(category)
      where not public.is_coach_permission_category(cat.category)
    );
$$;

-- Map health_records.metric_type → coach category (canonical Geoffit HealthMetricType values).
create or replace function public.coach_category_for_metric(p_metric_type text)
returns text
language sql
immutable
as $$
  select case p_metric_type
    when 'heart_rate' then 'vitals'
    when 'resting_heart_rate' then 'vitals'
    when 'heart_rate_variability' then 'vitals'
    when 'blood_pressure_systolic' then 'vitals'
    when 'blood_pressure_diastolic' then 'vitals'
    when 'step_count' then 'vitals'
    when 'vo2_max' then 'vitals'
    when 'sleep_analysis' then 'sleep'
    when 'body_mass' then 'body'
    when 'body_fat_percentage' then 'body'
    when 'lean_body_mass' then 'body'
    when 'body_mass_index' then 'body'
    when 'waist_circumference' then 'body'
    when 'height' then 'body'
    when 'dietary_energy' then 'nutrition'
    when 'dietary_protein' then 'nutrition'
    when 'dietary_carbohydrates' then 'nutrition'
    when 'dietary_fat' then 'nutrition'
    when 'dietary_fibre' then 'nutrition'
    when 'dietary_sugar' then 'nutrition'
    when 'dietary_water' then 'nutrition'
    when 'dietary_sodium' then 'nutrition'
    when 'dietary_alcohol' then 'nutrition'
    when 'dietary_caffeine' then 'nutrition'
    when 'workout' then 'training'
    else null
  end;
$$;

comment on function public.coach_category_for_metric(text) is
  'Maps health_records.metric_type to a coach permission category; null = not coach-readable via health_records.';

-- -----------------------------------------------------------------------------
-- coach_invitations
-- -----------------------------------------------------------------------------

create table if not exists public.coach_invitations (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references public.profiles (id) on delete cascade,
  coach_email text not null,
  coach_user_id uuid references public.profiles (id) on delete set null,
  token_hash text not null,
  status text not null
    check (status in ('pending', 'accepted', 'revoked', 'expired', 'declined')),
  permissions text[] not null
    check (public.coach_permissions_valid(permissions)),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_invitations_email_nonempty check (length(trim(coach_email)) > 0),
  constraint coach_invitations_token_hash_nonempty check (length(trim(token_hash)) > 0),
  constraint coach_invitations_email_normalized check (coach_email = lower(trim(coach_email)))
);

comment on table public.coach_invitations is
  'PLATFORM — Client→coach invitations. Stores token_hash only; never raw tokens.';

create unique index if not exists coach_invitations_pending_client_email_uq
  on public.coach_invitations (client_user_id, coach_email)
  where status = 'pending';

create unique index if not exists coach_invitations_token_hash_uq
  on public.coach_invitations (token_hash);

create index if not exists coach_invitations_coach_email_idx
  on public.coach_invitations (coach_email);

create index if not exists coach_invitations_client_idx
  on public.coach_invitations (client_user_id, created_at desc);

drop trigger if exists coach_invitations_set_updated_at on public.coach_invitations;
create trigger coach_invitations_set_updated_at
  before update on public.coach_invitations
  for each row execute function public.set_updated_at();

alter table public.coach_invitations enable row level security;
alter table public.coach_invitations force row level security;

-- Client manages invitations they created.
create policy coach_invitations_select_as_client
  on public.coach_invitations for select to authenticated
  using (client_user_id = (select auth.uid()));

create policy coach_invitations_insert_as_client
  on public.coach_invitations for insert to authenticated
  with check (
    client_user_id = (select auth.uid())
    and status = 'pending'
    and coach_user_id is null
    and accepted_at is null
    and revoked_at is null
  );

-- UPDATE is intentionally omitted for authenticated roles.
-- Pending invites are revoked via revoke_coach_invitation(); accepted via accept_coach_invitation().

-- Coach may see invitations addressed to their normalized email (accept UI).
create policy coach_invitations_select_as_invitee
  on public.coach_invitations for select to authenticated
  using (
    coach_email = lower(trim(coalesce((select auth.jwt() ->> 'email'), '')))
    or coach_user_id = (select auth.uid())
  );

grant select, insert on public.coach_invitations to authenticated;

-- -----------------------------------------------------------------------------
-- coach_client_relationships
-- -----------------------------------------------------------------------------

create table if not exists public.coach_client_relationships (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid not null references public.profiles (id) on delete cascade,
  client_user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null
    check (status in ('active', 'revoked')),
  permissions text[] not null
    check (public.coach_permissions_valid(permissions)),
  invitation_id uuid references public.coach_invitations (id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_client_relationships_distinct_users
    check (coach_user_id <> client_user_id)
);

comment on table public.coach_client_relationships is
  'PLATFORM — Many-to-many coach↔client grants. Coaches SELECT client facts only when active + category granted.';

create unique index if not exists coach_client_relationships_active_pair_uq
  on public.coach_client_relationships (coach_user_id, client_user_id)
  where status = 'active';

create index if not exists coach_client_relationships_coach_idx
  on public.coach_client_relationships (coach_user_id, status);

create index if not exists coach_client_relationships_client_idx
  on public.coach_client_relationships (client_user_id, status);

drop trigger if exists coach_client_relationships_set_updated_at
  on public.coach_client_relationships;
create trigger coach_client_relationships_set_updated_at
  before update on public.coach_client_relationships
  for each row execute function public.set_updated_at();

alter table public.coach_client_relationships enable row level security;
alter table public.coach_client_relationships force row level security;

create policy coach_client_relationships_select_participant
  on public.coach_client_relationships for select to authenticated
  using (
    coach_user_id = (select auth.uid())
    or client_user_id = (select auth.uid())
  );

-- INSERT/UPDATE/DELETE are intentionally omitted for authenticated roles.
-- Create via accept_coach_invitation(); revoke via revoke_coach_relationship().

grant select on public.coach_client_relationships to authenticated;

-- -----------------------------------------------------------------------------
-- Authorisation helper (SECURITY DEFINER, locked search_path)
-- Only answers: does auth.uid() have an active grant for (owner, category)?
-- -----------------------------------------------------------------------------

create or replace function public.can_coach_read(
  p_owner_id uuid,
  p_category text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or p_owner_id is null then
    return false;
  end if;
  if p_category is null or not public.is_coach_permission_category(p_category) then
    return false;
  end if;
  -- Never treat self-access as "coach read" via this helper.
  if v_uid = p_owner_id then
    return false;
  end if;

  return exists (
    select 1
    from public.coach_client_relationships r
    where r.coach_user_id = v_uid
      and r.client_user_id = p_owner_id
      and r.status = 'active'
      and p_category = any (r.permissions)
  );
end;
$$;

comment on function public.can_coach_read(uuid, text) is
  'True when auth.uid() is an active coach for owner_id with the given category grant. SECURITY DEFINER; search_path=public.';

revoke all on function public.can_coach_read(uuid, text) from public;
grant execute on function public.can_coach_read(uuid, text) to authenticated;

-- Narrow profile directory for coaches (display_name only).
create or replace function public.coach_visible_client_profile(p_client_id uuid)
returns table (id uuid, display_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or p_client_id is null then
    return;
  end if;
  if not exists (
    select 1
    from public.coach_client_relationships r
    where r.coach_user_id = v_uid
      and r.client_user_id = p_client_id
      and r.status = 'active'
  ) then
    return;
  end if;

  return query
  select p.id, p.display_name
  from public.profiles p
  where p.id = p_client_id
    and p.deleted_at is null;
end;
$$;

comment on function public.coach_visible_client_profile(uuid) is
  'Returns id + display_name for an active coached client only. No other profile fields.';

revoke all on function public.coach_visible_client_profile(uuid) from public;
grant execute on function public.coach_visible_client_profile(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Fact table SELECT policies for coaches (additive; owner policies unchanged)
-- INSERT/UPDATE/DELETE remain owner-only.
-- -----------------------------------------------------------------------------

-- health_records: category derived from metric_type
drop policy if exists health_records_select_coach on public.health_records;
create policy health_records_select_coach
  on public.health_records for select to authenticated
  using (
    deleted_at is null
    and public.can_coach_read(
      user_id,
      public.coach_category_for_metric(metric_type)
    )
  );

-- blood
drop policy if exists blood_panels_select_coach on public.blood_panels;
create policy blood_panels_select_coach
  on public.blood_panels for select to authenticated
  using (
    deleted_at is null
    and public.can_coach_read(user_id, 'blood')
  );

drop policy if exists blood_results_select_coach on public.blood_results;
create policy blood_results_select_coach
  on public.blood_results for select to authenticated
  using (
    deleted_at is null
    and public.can_coach_read(user_id, 'blood')
  );

-- training
drop policy if exists workouts_select_coach on public.workouts;
create policy workouts_select_coach
  on public.workouts for select to authenticated
  using (
    deleted_at is null
    and public.can_coach_read(user_id, 'training')
  );

-- nutrition
drop policy if exists nutrition_days_select_coach on public.nutrition_days;
create policy nutrition_days_select_coach
  on public.nutrition_days for select to authenticated
  using (
    deleted_at is null
    and public.can_coach_read(user_id, 'nutrition')
  );

-- treatments
drop policy if exists treatments_select_coach on public.treatments;
create policy treatments_select_coach
  on public.treatments for select to authenticated
  using (
    deleted_at is null
    and public.can_coach_read(user_id, 'treatments')
  );

drop policy if exists treatment_lots_select_coach on public.treatment_lots;
create policy treatment_lots_select_coach
  on public.treatment_lots for select to authenticated
  using (
    deleted_at is null
    and public.can_coach_read(user_id, 'treatments')
  );

drop policy if exists treatment_dose_events_select_coach
  on public.treatment_dose_events;
create policy treatment_dose_events_select_coach
  on public.treatment_dose_events for select to authenticated
  using (
    deleted_at is null
    and public.can_coach_read(user_id, 'treatments')
  );

-- -----------------------------------------------------------------------------
-- Invitation accept (atomic; token_hash lookup; email match; relationship upsert)
-- -----------------------------------------------------------------------------

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

  select * into v_inv
  from public.coach_invitations
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'invalid invitation' using errcode = '22023';
  end if;

  if v_inv.status <> 'pending' then
    raise exception 'invitation not pending' using errcode = '22023';
  end if;

  if v_inv.expires_at <= now() then
    update public.coach_invitations
    set status = 'expired', updated_at = now()
    where id = v_inv.id;
    raise exception 'invitation expired' using errcode = '22023';
  end if;

  -- Opaque failure when email does not match (no account-existence leak).
  if v_inv.coach_email <> v_email then
    raise exception 'invalid invitation' using errcode = '22023';
  end if;

  if v_inv.client_user_id = v_uid then
    raise exception 'invalid invitation' using errcode = '22023';
  end if;

  -- Prefer existing active relationship (idempotent re-accept edge case).
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
    -- Reactivate most recent revoked relationship, else insert.
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

comment on function public.accept_coach_invitation(text) is
  'Accept a pending coach invitation by token_hash. Creates/reactivates active relationship. Opaque errors.';

revoke all on function public.accept_coach_invitation(text) from public;
grant execute on function public.accept_coach_invitation(text) to authenticated;

create or replace function public.revoke_coach_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.coach_invitations%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_invitation_id is null then
    raise exception 'invitation not found' using errcode = '22023';
  end if;

  select * into v_inv
  from public.coach_invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'invitation not found' using errcode = '22023';
  end if;

  if v_inv.client_user_id <> v_uid then
    raise exception 'invitation not found' using errcode = '22023';
  end if;

  if v_inv.status <> 'pending' then
    raise exception 'invitation not pending' using errcode = '22023';
  end if;

  update public.coach_invitations
  set
    status = 'revoked',
    revoked_at = now(),
    updated_at = now()
  where id = v_inv.id;

  return v_inv.id;
end;
$$;

comment on function public.revoke_coach_invitation(uuid) is
  'Client revokes a pending invitation. Opaque errors for non-owners.';

revoke all on function public.revoke_coach_invitation(uuid) from public;
grant execute on function public.revoke_coach_invitation(uuid) to authenticated;

create or replace function public.revoke_coach_relationship(p_relationship_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rel public.coach_client_relationships%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_relationship_id is null then
    raise exception 'relationship not found' using errcode = '22023';
  end if;

  select * into v_rel
  from public.coach_client_relationships
  where id = p_relationship_id
  for update;

  if not found then
    raise exception 'relationship not found' using errcode = '22023';
  end if;

  if v_rel.coach_user_id <> v_uid and v_rel.client_user_id <> v_uid then
    raise exception 'relationship not found' using errcode = '22023';
  end if;

  if v_rel.status <> 'active' then
    raise exception 'relationship not active' using errcode = '22023';
  end if;

  update public.coach_client_relationships
  set
    status = 'revoked',
    revoked_at = now(),
    updated_at = now()
  where id = v_rel.id;

  return v_rel.id;
end;
$$;

comment on function public.revoke_coach_relationship(uuid) is
  'Revoke an active coach↔client relationship. Callable by coach or client only.';

revoke all on function public.revoke_coach_relationship(uuid) from public;
grant execute on function public.revoke_coach_relationship(uuid) to authenticated;
