# Geoffit Database Architecture — Security

## 1. Authentication

- Supabase Auth; `profiles.id = auth.uid()`  
- SSR cookie session via `@supabase/ssr` + `proxy.ts`  
- Server authorization uses `getUser` / `getClaims` — not raw `getSession` alone  
- MFA planned for accounts with medications + labs  

## 2. Authorization & RLS

- RLS on every personal table; deny by default  
- v1: `user_id = auth.uid()` (+ `deleted_at IS NULL` on SELECT)  
- v2: workspace grants (see `10-future.md`)  
- System catalogs (`biomarker_definitions`, `feature_flags` definitions): authenticated read; service write  

## 3. AI write barrier *(critical)*

| Allowed | Forbidden |
|---------|-----------|
| Insert/update `ai_*` tables for the user | UPDATE/DELETE on `medications`, `blood_*`, `body_*`, `medication_dose_events`, `health_events`, etc. |
| Create `ai_recommendations` / `ai_summaries` | Silent clinical corrections |
| Propose actions in UI | Service-role AI tools without user JWT scoping |

**Implementation intent:** AI Edge Functions use a user-scoped client (or RPC that only whitelists AI tables). Clinical mutations require explicit user-confirmed APIs.

## 4. Ingestion security

- Uploads authenticated; size/type limits  
- `sync_token_ref` → Vault; never plaintext tokens in `connected_sources`  
- raw_payloads private Storage paths `{user_id}/...`  

## 5. Notifications security

- Queue workers verify user + preference opt-in  
- Templates cannot interpolate other users’ data  
- No PII in push title beyond what’s necessary  

## 6. Audit logging

`audit_log` for: source connect/disconnect, blood delete, medication stop, supply void, AI memory delete, exports, feature-flag break-glass, share grants.

## 7. Encryption & secrets

- TLS + provider at-rest encryption  
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` public; **never** service_role in clients  
- LLM keys / OAuth secrets in Edge/Vault only  

## 8. API surface

- Expose fact tables carefully; prefer views for mobile DTOs  
- Rate-limit ingest and AI task creation  
- Signed URLs for files (short TTL)  

## 9. Timeline & reports

- Timeline SELECT under same user RLS  
- Reports/AI summaries readable by owner only; regenerable ≠ public  
