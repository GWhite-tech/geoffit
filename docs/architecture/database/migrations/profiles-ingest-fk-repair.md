# Profiles ↔ ingest_runs FK repair

## Root cause

```text
auth.users.id
    │
    ▼ (1:1, same UUID)
profiles.id   ◄── ingest_runs.user_id  (FK ingest_runs_user_id_fkey)
```

`ingest_runs.user_id` correctly references **`profiles.id`**, not `auth.users` directly.  
Your auth session was valid (`auth.users` row exists) but **no matching `profiles` row**, so the insert failed.

### Why the profile was missing

1. **Signup trigger** `on_auth_user_created` → `handle_new_user()` does create profiles for *new* signups after Phase 1 was applied.
2. Accounts created **before** `profiles` / the trigger existed never got a row.
3. **`ensureProfile()` on login** ran, but failures were swallowed (`loginAction` catch), so login succeeded without a profile.
4. **`AuthProvider`** previously only *fetched* profiles — it did not create them.
5. Upload created `ingest_runs` without ensuring a profile first.

## Fixes

| Layer | Change |
|-------|--------|
| Migration | `20260806140000_backfill_profiles.sql` — insert profiles (+ default prefs) for all `auth.users` missing rows; adds `ensure_own_profile()` RPC |
| App | `ensureAuthenticatedProfile()` — upsert or RPC |
| Upload | `uploadIngestDocument` calls ensure **before** any `ingest_runs` insert |
| Auth | `AuthProvider` ensures profile on session load |

## Apply

```bash
supabase db push
# or run 20260806140000_backfill_profiles.sql in the SQL editor
```

Verify:

```bash
psql "$DATABASE_URL" -f supabase/migrations/verify/20260806140000_backfill_profiles.sql
# Expect 0 rows
```

Then retry the blood PDF upload (signed in).
