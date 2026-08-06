# Geoffit Database Architecture — Testing Strategy

**Status:** Design only. Applies before and after first SQL migrations.

---

## 1. Goals

Prove: facts stay correct, RLS never leaks, AI cannot mutate clinical data, sync is idempotent, offline converges, migrations are expandable, performance hot paths stay bounded.

---

## 2. RLS testing

| Test | Assert |
|------|--------|
| Isolation | User A cannot SELECT/UPDATE/DELETE user B rows on every personal table |
| Soft delete | Soft-deleted rows hidden from normal SELECT policies |
| Catalogs | biomarker_definitions readable; not user-writable |
| Storage paths | Signed URL / policy cannot read other user prefix |
| Service role | Only available in trusted tests; document blast radius |
| Future grants | Workspace member reads only granted slices (pre-portal suite) |

Harness: two JWTs + SQL/RPC assertions in CI on ephemeral DB.

---

## 3. Sync / ingestion testing

| Test | Assert |
|------|--------|
| Idempotent re-ingest | Same payload twice → same fact ids/counts |
| Fingerprint stability | Known fixtures → fixed fingerprints |
| Cursor advance | sync_state moves only after success |
| Partial failure | Failed page retries without duplicating prior pages |
| Conflict park | Divergent values → conflict_records |
| Tombstones | Delete propagates to second client pull |
| Provider fixtures | AH XML snippet, Hevy JSON, Withings measures |

---

## 4. Migration testing

| Test | Assert |
|------|--------|
| Forward migrate | Empty → latest |
| Expand/contract | Old app DTO still reads after additive migration |
| Backfill jobs | Nullable → populated → NOT NULL path |
| Rollback philosophy | Roll **forward** fix; backup restore tested separately |
| Seed + migrate | Demo user survives N migrations |

---

## 5. AI safety testing

| Test | Assert |
|------|--------|
| Write barrier | AI role/JWT cannot UPDATE body_weight / blood_results / medications / doses |
| Allowlist | AI can INSERT ai_messages / ai_recommendations |
| Accept path | AcceptRecommendation → user command creates dose; model cannot |
| Citations | Recommendation payload includes fact pointers |
| No score SoT | Attempt insert into forbidden score tables fails (tables absent) |

Treat AI safety as **release-blocking**.

---

## 6. Performance testing

| Test | Assert |
|------|--------|
| Timeline page | p95 < budget at 100k entries/user |
| Fingerprint upsert | Bulk ingest N weights under budget |
| HR partition | Insert + prune path tested |
| MC queries | Latest facts under budget with cold cache |
| Explain plans | Hot paths use expected indexes (CI snapshot) |

Use synthetic generators; do not require production data.

---

## 7. Property / invariant testing

Examples:

- Ledger: sum(deltas) == quantity_after chain  
- Dose void: voided events excluded from adherence counts  
- Sleep: at most one `is_primary` per night per preference rule  
- Timeline: every workout has ≤1 pointer entry  
- Supersede: invalid facts not returned by default queries  
- Fingerprint unique among active rows  

---

## 8. Multi-app testing

| Client | Contract |
|--------|----------|
| Web | Current API |
| iOS n-1 | Additive fields ignored; writes still valid |
| Android n-1 | Same |
| Unknown entry_type | Timeline skips gracefully |

Contract tests against frozen OpenAPI/DTO fixtures (when APIs exist).

---

## 9. Offline sync testing

| Scenario | Assert |
|----------|--------|
| Dose offline → online | Exactly one dose_event (`client_op_id`) |
| Concurrent weight edit | Conflict or supersede per policy — never silent clobber without history |
| Queue replay order | Causal order per aggregate |
| Tombstone while offline | Converges on pull |
| Auth expiry offline | Queue retains; no clinical loss |

---

## 10. Domain event testing

- Outbox written in same transaction as fact (when outbox exists)  
- Publisher idempotency  
- Consumer timeline projector exactly-once effect (upsert pointer)  

---

## 11. Security / abuse

- Upload size limits  
- Rate limit ingest/AI tasks  
- Template injection cannot read other users  
- Export only own data  

---

## 12. Test data & environments

| Env | Purpose |
|-----|---------|
| CI ephemeral DB | RLS + migrations + properties |
| Staging | Full connector sandbox keys |
| Load | Synthetic HR firehose |
| Privacy | No production dumps in laptops |

---

## 13. Release gates (DB-related)

1. RLS suite green  
2. AI write-barrier suite green  
3. Idempotent ingest fixtures green  
4. Migration expand/contract green  
5. Hot-path explain/budget green  
6. Offline dose idempotency green  
