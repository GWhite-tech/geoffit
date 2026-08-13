-- Local-only coach RLS / RPC verification (psql via docker exec).
-- Never run against production.
\set ON_ERROR_STOP on

begin;

create temporary table coach_rls_results (
  name text primary key,
  ok boolean not null,
  detail text
);

create or replace function pg_temp.chk(p_name text, p_ok boolean, p_detail text default null)
returns void language plpgsql as $$
begin
  insert into coach_rls_results(name, ok, detail)
  values (p_name, p_ok, p_detail)
  on conflict (name) do update set ok = excluded.ok, detail = excluded.detail;
end;
$$;

create temporary table coach_rls_ids (
  client_a uuid,
  client_b uuid,
  coach_auth uuid,
  coach_unauth uuid,
  stamp text,
  raw text,
  hash text,
  hash2 text,
  hash3 text,
  hash4 text,
  invite_id uuid,
  rel_id uuid,
  hr_id uuid
);

insert into coach_rls_ids (
  client_a, client_b, coach_auth, coach_unauth, stamp, raw, hash, hash2, hash3, hash4
) values (
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  extract(epoch from now())::bigint::text,
  encode(gen_random_bytes(32), 'hex'),
  encode(digest(encode(gen_random_bytes(16), 'hex'), 'sha256'), 'hex'),
  encode(digest(encode(gen_random_bytes(16), 'hex') || '2', 'sha256'), 'hex'),
  encode(digest(encode(gen_random_bytes(16), 'hex') || '3', 'sha256'), 'hex'),
  encode(digest(encode(gen_random_bytes(16), 'hex') || '4', 'sha256'), 'hex')
);

-- Fix hash to be digest of raw for the primary invite
update coach_rls_ids set hash = encode(digest(raw, 'sha256'), 'hex');

-- Seed users/profiles/facts as postgres (bypass RLS for fixtures)
do $$
declare
  r coach_rls_ids%rowtype;
begin
  select * into r from coach_rls_ids;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values
    (r.client_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'client-a-' || r.stamp || '@example.com', crypt('pw', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Client A"}'::jsonb,
     now(), now(), '', '', '', ''),
    (r.client_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'client-b-' || r.stamp || '@example.com', crypt('pw', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Client B"}'::jsonb,
     now(), now(), '', '', '', ''),
    (r.coach_auth, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'coach-auth-' || r.stamp || '@example.com', crypt('pw', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Coach Auth"}'::jsonb,
     now(), now(), '', '', '', ''),
    (r.coach_unauth, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'coach-unauth-' || r.stamp || '@example.com', crypt('pw', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Coach Unauth"}'::jsonb,
     now(), now(), '', '', '', '');

  insert into public.profiles (id, display_name, email) values
    (r.client_a, 'Client A', 'client-a-' || r.stamp || '@example.com'),
    (r.client_b, 'Client B', 'client-b-' || r.stamp || '@example.com'),
    (r.coach_auth, 'Coach Auth', 'coach-auth-' || r.stamp || '@example.com'),
    (r.coach_unauth, 'Coach Unauth', 'coach-unauth-' || r.stamp || '@example.com')
  on conflict (id) do update set display_name = excluded.display_name;

  insert into public.health_records (user_id, fingerprint, source, metric_type, value, unit, start_at, end_at, duration_minutes, sleep_value, payload)
  values
    (r.client_a, 'hr|' || r.stamp, 'test', 'heart_rate', 60, 'count/min', now(), null, null, null, '{}'),
    (r.client_a, 'sleep|' || r.stamp, 'test', 'sleep_analysis', null, null, now(), now(), 420, 'ASLEEP', '{}'),
    (r.client_a, 'body|' || r.stamp, 'test', 'body_mass', 80, 'kg', now(), null, null, null, '{}'),
    (r.client_b, 'hr-b|' || r.stamp, 'test', 'heart_rate', 55, 'count/min', now(), null, null, null, '{}');

  insert into public.workouts (user_id, fingerprint, source, activity_type, start_at, end_at, duration_seconds, payload)
  values (r.client_a, 'workout|' || r.stamp, 'test', 'TraditionalStrengthTraining', now(), now(), 3600, '{}');

  insert into public.blood_panels (user_id, fingerprint, source, test_date, provider, panel_name, source_file_name, payload)
  values (r.client_a, 'panel|' || r.stamp, 'test', current_date, 'test', 'Numan', 'fixture.pdf', '{}');

  insert into public.blood_results (user_id, panel_id, fingerprint, source, marker_key, name, value, unit, payload)
  select r.client_a, id, 'result|' || r.stamp, 'test', 'total_testosterone', 'Total Testosterone', 11.3, 'nmol/L', '{}'
  from public.blood_panels where fingerprint = 'panel|' || r.stamp;

  update coach_rls_ids i
  set hr_id = h.id
  from public.health_records h
  where h.fingerprint = 'hr|' || i.stamp;
end;
$$;

-- Helper: assume JWT identity
create or replace function pg_temp.as_user(p_uid uuid, p_email text)
returns void language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_uid::text,
      'role', 'authenticated',
      'email', p_email
    )::text,
    true
  );
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.email', p_email, true);
end;
$$;

grant select, update, insert on coach_rls_results to authenticated;
grant select, update on coach_rls_ids to authenticated;
grant execute on function pg_temp.chk(text, boolean, text) to authenticated;
grant execute on function pg_temp.as_user(uuid, text) to authenticated;

-- Drop to authenticated for policy tests
set local role authenticated;

do $$
declare
  r coach_rls_ids%rowtype;
  v_types text[];
  v_count int;
  v_value double precision;
  v_profile record;
  v_tmp uuid;
  v_safe_id uuid;
  v_leaked_hash text;
begin
  select * into r from coach_rls_ids;

  -- Client creates invitation
  perform pg_temp.as_user(r.client_a, 'client-a-' || r.stamp || '@example.com');
  begin
    insert into public.coach_invitations (
      client_user_id, coach_email, token_hash, status, permissions, expires_at
    ) values (
      r.client_a, 'coach-auth-' || r.stamp || '@example.com', r.hash, 'pending',
      array['vitals','sleep','training']::text[], now() + interval '1 day'
    ) returning id into v_tmp;
    update coach_rls_ids set invite_id = v_tmp;
    perform pg_temp.chk('client can create invitation', v_tmp is not null);
  exception when others then
    perform pg_temp.chk('client can create invitation', false, SQLERRM);
  end;

  begin
    insert into public.coach_invitations (
      client_user_id, coach_email, token_hash, status, permissions, expires_at
    ) values (
      r.client_a, 'coach-auth-' || r.stamp || '@example.com', r.hash2, 'pending',
      array['vitals']::text[], now() + interval '1 day'
    );
    perform pg_temp.chk('duplicate pending invitation rejected', false, 'insert succeeded');
  exception when unique_violation then
    perform pg_temp.chk('duplicate pending invitation rejected', true);
  when others then
    perform pg_temp.chk('duplicate pending invitation rejected', SQLSTATE = '23505', SQLERRM);
  end;

  -- Token privacy: invitee may read safe columns, never token_hash
  perform pg_temp.as_user(r.coach_auth, 'coach-auth-' || r.stamp || '@example.com');
  begin
    select token_hash into v_leaked_hash
    from public.coach_invitations
    where id = (select invite_id from coach_rls_ids);
    perform pg_temp.chk(
      'invitee cannot SELECT token_hash',
      false,
      'select succeeded: ' || coalesce(left(v_leaked_hash, 12), 'null')
    );
  exception when insufficient_privilege then
    perform pg_temp.chk('invitee cannot SELECT token_hash', true);
  when others then
    perform pg_temp.chk(
      'invitee cannot SELECT token_hash',
      SQLSTATE = '42501',
      SQLERRM
    );
  end;

  begin
    select id into v_safe_id
    from public.coach_invitations
    where id = (select invite_id from coach_rls_ids)
      and status = 'pending'
      and coach_email = 'coach-auth-' || r.stamp || '@example.com'
      and permissions is not null
      and expires_at is not null;
    perform pg_temp.chk(
      'invitee can SELECT safe invitation fields',
      v_safe_id is not null,
      coalesce(v_safe_id::text, 'null')
    );
  exception when others then
    perform pg_temp.chk('invitee can SELECT safe invitation fields', false, SQLERRM);
  end;

  -- Email alone (wrong digest) cannot accept
  begin
    perform public.accept_coach_invitation(
      encode(digest('email-only-no-token-' || r.stamp, 'sha256'), 'hex')
    );
    perform pg_temp.chk('coach_email alone cannot accept invitation', false);
  exception when others then
    perform pg_temp.chk(
      'coach_email alone cannot accept invitation',
      SQLERRM ilike '%invalid invitation%',
      SQLERRM
    );
  end;

  -- Accept via correct token_hash (server-side digest of raw token)
  begin
    v_tmp := public.accept_coach_invitation(r.hash);
    update coach_rls_ids set rel_id = v_tmp;
    perform pg_temp.chk('accept invitation creates relationship', v_tmp is not null, v_tmp::text);
  exception when others then
    perform pg_temp.chk('accept invitation creates relationship', false, SQLERRM);
  end;

  begin
    perform public.accept_coach_invitation(r.hash);
    perform pg_temp.chk('invitation token is single-use', false, 'second accept succeeded');
  exception when others then
    perform pg_temp.chk(
      'invitation token is single-use',
      SQLERRM ilike '%not pending%' or SQLERRM ilike '%invalid%',
      SQLERRM
    );
  end;

  -- email mismatch invite (insert as postgres briefly — need elevated for fixture invite)
  -- Use SECURITY DEFINER accept path only; insert pending invite via privilege reset below.
end;
$$;

reset role;

-- Seed extra invitations as postgres (one pending per client+email)
do $$
declare r coach_rls_ids%rowtype;
begin
  select * into r from coach_rls_ids;
  insert into public.coach_invitations (
    client_user_id, coach_email, token_hash, status, permissions, expires_at
  ) values
    (r.client_a, 'other-' || r.stamp || '@example.com', r.hash2, 'pending',
     array['blood']::text[], now() + interval '1 day'),
    (r.client_a, 'coach-unauth-' || r.stamp || '@example.com', r.hash3, 'pending',
     array['blood']::text[], now() - interval '1 day');

  insert into public.coach_client_relationships (
    coach_user_id, client_user_id, status, permissions, accepted_at
  ) values (
    r.coach_auth, r.client_b, 'active', array['vitals']::text[], now()
  );
end;
$$;

set local role authenticated;

do $$
declare
  r coach_rls_ids%rowtype;
  v_types text[];
  v_count int;
  v_value double precision;
  v_profile record;
  v_tmp uuid;
begin
  select * into r from coach_rls_ids;

  -- email mismatch
  perform pg_temp.as_user(r.coach_auth, 'coach-auth-' || r.stamp || '@example.com');
  begin
    perform public.accept_coach_invitation(r.hash2);
    perform pg_temp.chk('email mismatch is opaque invalid invitation', false);
  exception when others then
    perform pg_temp.chk(
      'email mismatch is opaque invalid invitation',
      SQLERRM ilike '%invalid invitation%',
      SQLERRM
    );
  end;

  -- expired (expire_stale must run in its own committed statement — here we
  -- call it then accept; within one transaction both are visible)
  perform pg_temp.as_user(r.coach_unauth, 'coach-unauth-' || r.stamp || '@example.com');
  perform public.expire_stale_coach_invitations();
  begin
    perform public.accept_coach_invitation(r.hash3);
    perform pg_temp.chk('expired invitation cannot be accepted', false);
  exception when others then
    perform pg_temp.chk(
      'expired invitation cannot be accepted',
      SQLERRM ilike '%expired%',
      SQLERRM
    );
  end;

  -- authorised coach reads
  perform pg_temp.as_user(r.coach_auth, 'coach-auth-' || r.stamp || '@example.com');
  select array_agg(metric_type order by metric_type) into v_types
  from public.health_records where user_id = r.client_a;
  perform pg_temp.chk(
    'authorised coach can SELECT granted health_records',
    coalesce(v_types, array[]::text[]) @> array['heart_rate','sleep_analysis']::text[],
    array_to_string(v_types, ',')
  );
  perform pg_temp.chk(
    'category isolation: no body_mass without body permission',
    not (coalesce(v_types, array[]::text[]) @> array['body_mass']::text[]),
    array_to_string(v_types, ',')
  );

  select count(*) into v_count from public.workouts where user_id = r.client_a;
  perform pg_temp.chk('authorised coach can SELECT workouts with training', v_count > 0, v_count::text);

  select count(*) into v_count from public.blood_panels where user_id = r.client_a;
  perform pg_temp.chk('category isolation: no blood without blood permission', v_count = 0, v_count::text);

  -- unauthorised coach
  perform pg_temp.as_user(r.coach_unauth, 'coach-unauth-' || r.stamp || '@example.com');
  select count(*) into v_count from public.health_records where user_id = r.client_a;
  perform pg_temp.chk('unauthorised coach cannot SELECT client health_records', v_count = 0, v_count::text);

  -- second client
  perform pg_temp.as_user(r.client_b, 'client-b-' || r.stamp || '@example.com');
  select count(*) into v_count from public.health_records where user_id = r.client_a;
  perform pg_temp.chk('second client cannot SELECT client A health_records', v_count = 0, v_count::text);

  -- owner
  perform pg_temp.as_user(r.client_a, 'client-a-' || r.stamp || '@example.com');
  select count(*) into v_count from public.health_records where user_id = r.client_a;
  perform pg_temp.chk('client retains owner SELECT on health_records', v_count >= 3, v_count::text);

  -- coach write attempts
  perform pg_temp.as_user(r.coach_auth, 'coach-auth-' || r.stamp || '@example.com');
  begin
    update public.health_records set value = 999 where id = r.hr_id;
    get diagnostics v_count = row_count;
    perform pg_temp.chk('coach cannot UPDATE client health_records', v_count = 0, v_count::text);
  exception when others then
    perform pg_temp.chk('coach cannot UPDATE client health_records', true, SQLERRM);
  end;

  begin
    delete from public.health_records where id = r.hr_id;
    get diagnostics v_count = row_count;
    perform pg_temp.chk('coach cannot DELETE client health_records', v_count = 0, v_count::text);
  exception when others then
    perform pg_temp.chk('coach cannot DELETE client health_records', true, SQLERRM);
  end;

  -- cannot insert relationship
  perform pg_temp.as_user(r.coach_unauth, 'coach-unauth-' || r.stamp || '@example.com');
  begin
    insert into public.coach_client_relationships (
      coach_user_id, client_user_id, status, permissions
    ) values (r.coach_unauth, r.client_a, 'active', array['blood','vitals']::text[]);
    perform pg_temp.chk('coach cannot INSERT relationship directly', false);
  exception when others then
    perform pg_temp.chk('coach cannot INSERT relationship directly', true, SQLERRM);
  end;

  -- revoke
  perform pg_temp.as_user(r.client_a, 'client-a-' || r.stamp || '@example.com');
  begin
    perform public.revoke_coach_relationship(r.rel_id);
    perform pg_temp.chk('client can revoke relationship', true);
  exception when others then
    perform pg_temp.chk('client can revoke relationship', false, SQLERRM);
  end;

  perform pg_temp.as_user(r.coach_auth, 'coach-auth-' || r.stamp || '@example.com');
  select count(*) into v_count from public.health_records where user_id = r.client_a;
  perform pg_temp.chk('revoked coach loses SELECT immediately', v_count = 0, v_count::text);

end;
$$;

reset role;

-- Persist expiry then create a fresh pending invite for second coach
select public.expire_stale_coach_invitations();

do $$
declare r coach_rls_ids%rowtype;
begin
  select * into r from coach_rls_ids;
  insert into public.coach_invitations (
    client_user_id, coach_email, token_hash, status, permissions, expires_at
  ) values (
    r.client_a, 'coach-unauth-' || r.stamp || '@example.com', r.hash4, 'pending',
    array['blood']::text[], now() + interval '1 day'
  );
end;
$$;

set local role authenticated;

do $$
declare
  r coach_rls_ids%rowtype;
  v_count int;
  v_profile record;
begin
  select * into r from coach_rls_ids;

  perform pg_temp.as_user(r.coach_unauth, 'coach-unauth-' || r.stamp || '@example.com');
  begin
    perform public.accept_coach_invitation(r.hash4);
    perform pg_temp.chk('second coach can accept invite for same client', true);
  exception when others then
    perform pg_temp.chk('second coach can accept invite for same client', false, SQLERRM);
  end;

  select count(*) into v_count from public.blood_panels where user_id = r.client_a;
  perform pg_temp.chk('second coach with blood can read blood panels', v_count > 0, v_count::text);

  select count(*) into v_count from public.health_records where user_id = r.client_b;
  perform pg_temp.chk('coaches cannot see each other unrelated clients', v_count = 0, v_count::text);

  select * into v_profile from public.coach_visible_client_profile(r.client_a) limit 1;
  perform pg_temp.chk(
    'coach_visible_client_profile returns id+display_name',
    v_profile.id = r.client_a and v_profile.display_name is not null,
    coalesce(v_profile.display_name, 'null')
  );
end;
$$;

reset role;

-- Value / token storage checks as postgres (token_hash not selectable by authenticated)
do $$
declare
  r coach_rls_ids%rowtype;
  v_value double precision;
  v_hash text;
begin
  select * into r from coach_rls_ids;
  select value into v_value from public.health_records where id = r.hr_id;
  perform pg_temp.chk(
    'client health_records unchanged after coach write attempts',
    v_value = 60,
    coalesce(v_value::text, 'null')
  );

  select token_hash into v_hash
  from public.coach_invitations
  where id = r.invite_id;

  perform pg_temp.chk(
    'invitation never stores raw token',
    v_hash is not null
      and v_hash = encode(digest(r.raw, 'sha256'), 'hex')
      and v_hash <> r.raw,
    coalesce(left(v_hash, 12), 'null')
  );
end;
$$;

select case when ok then 'PASS' else 'FAIL' end as status, name, detail
from coach_rls_results
order by ok desc, name;

select
  count(*) filter (where ok) as passed,
  count(*) filter (where not ok) as failed,
  count(*) as total
from coach_rls_results;

do $$
begin
  if exists (select 1 from coach_rls_results where not ok) then
    raise exception 'coach RLS local verification failed';
  end if;
end;
$$;

rollback;
