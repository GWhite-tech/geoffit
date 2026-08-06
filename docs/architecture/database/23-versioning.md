# Geoffit Database Architecture — Versioning & Schema Evolution

**Status:** Design only. 10-year evolution rules.

---

## 1. Principles

1. **Expand/contract** — add columns nullable first; never break old readers in the same deploy.  
2. **Facts are history** — corrections add revisions (`supersedes_id` / new row), not silent overwrites.  
3. **Derived is regenerable** — AI/reports/scores can be wiped and rebuilt.  
4. **Clients are multi-version** — iOS/Android/web lag weeks behind API.  
5. **Events version payloads** — `schema_version` on domain events.  

---

## 2. Schema change playbook

| Change type | Safe method |
|-------------|-------------|
| Add nullable column | Ship; backfill async; then enforce NOT NULL if needed |
| Add required column | Add nullable → backfill → constrain |
| Rename column | Add new → dual-write → switch reads → drop old (multi-release) |
| Drop column | Ensure no client < N uses it; feature-flag; then drop |
| Change enum values | Additive first; deprecate old via app; never reuse meanings |
| Split table | New table + projection; dual-read; cutover flag |
| Merge table | Views for old shape during transition |
| Change PK/FK | Avoid; use new surrogate + backfill |

**Migrations:** forward-only in production; roll forward with flags, not restore-to-undo (unless disaster — see `25-disaster-recovery.md`).

---

## 3. Fact versioning (clinical history)

| Pattern | Use |
|---------|-----|
| Append-only ledger | dose_events, inventory_transactions, treatment_events, audit_log |
| Superseding revision | weight, labs results corrections, workout structure corrections |
| Soft delete + tombstone | user removals syncing to clients |
| Void | mistaken ledger entries |

**Forbidden:** UPDATE `value_kg` in place without leaving prior value queryable.

API shape: `CorrectWeight({ supersedes_id, new_value })` → insert + set `invalid_at` on prior.

---

## 4. Ingestion evolution

| Concern | Approach |
|---------|----------|
| Mapper versions | `ingest_runs.stats.mapper_version`; reprocess raw_payloads |
| Fingerprint algorithm change | New fingerprint namespace prefix (`v2:…`); dual-lookup period |
| Provider API v2 | New cursor resource in `sync_state`; don’t reuse incompatible cursors |
| Raw payload retention | Enough to replay (see DR); GC after N days only if replay stored elsewhere |
| Re-ingest | Idempotent upsert by fingerprint; emit `*Corrected` if values change under policy |

---

## 5. AI memory & derived artifact versioning

| Artifact | Version field | Rebuild |
|----------|---------------|---------|
| ai_embeddings | `model_version` + `content_hash` | Re-embed on model change |
| ai_summaries / reports | `model_version` | Regenerate from facts |
| ai_memory | content editable; keep `updated_at`; optional history table later | User-owned |
| ai_recommendations | expire; don’t mutate clinical | Regenerate |
| photo_ai_comparisons | `model_version` | Delete + redo |
| achievements | `rule_id` + `model_version` | Recompute awards |

Old app versions may show stale summaries; acceptable if facts remain correct.

---

## 6. Mobile / multi-app compatibility

| Mechanism | Purpose |
|-----------|---------|
| `api_min_version` / `api_max_version` headers | Gate breaking changes |
| Feature flags | Hide new domains on old clients |
| Additive DTOs | Unknown fields ignored by old clients |
| `revision` on rows | Optimistic concurrency for offline |
| sync_tombstones | Deletes across versions |
| Contract tests | See `26-testing-strategy.md` |

Native iOS/Android and web must tolerate:

- New timeline entry_types (ignore unknown)  
- New providers in connected_sources  
- New medication forms / treatment kinds  

---

## 7. Event versioning

- Name stable forever (`WeightRecorded`)  
- Payload evolves with `schema_version: 1|2|…`  
- Consumers tolerate missing new fields  
- Breaking payload changes → new event type only when semantics break  

---

## 8. Workspace / RLS evolution

v1: `user_id = auth.uid()`.  
v2: introduce `workspace_id` + grants **before** clinician portal ships.

**Rule:** Do not wait until portal launch to invent tenancy — add nullable `workspace_id` early or a central `resource_grants` table to avoid rewriting every RLS policy later.

---

## 9. Deprecation timeline template

```text
T0  Add new shape (flag off)
T1  Dual-write / dual-read (flag %)
T2  New path default; old path read-only
T3  Old clients below min version blocked from write
T4  Remove old columns/tables
```

Minimum 2 native release cycles between T2 and T4.
