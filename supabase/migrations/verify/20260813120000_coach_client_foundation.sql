-- Manual verification helpers for coach/client foundation (do not auto-run in prod).
-- Expect: tables, helper functions, and SELECT coach policies present.

select to_regclass('public.coach_invitations') is not null as has_invitations;
select to_regclass('public.coach_client_relationships') is not null as has_relationships;

select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'can_coach_read',
    'coach_category_for_metric',
    'accept_coach_invitation',
    'expire_stale_coach_invitations',
    'revoke_coach_invitation',
    'revoke_coach_relationship',
    'coach_visible_client_profile',
    'is_coach_permission_category'
  )
order by 1;

select polname, rel.relname
from pg_policy pol
join pg_class rel on rel.oid = pol.polrelid
where pol.polname like '%_select_coach'
order by 2, 1;
