# Geoffit Database Architecture — Readiness Report (Freeze Gate)

**Reviewer role:** Principal Software Architect  
**Scope:** `docs/architecture/database` (v1 design pack through `26-testing-strategy.md`)  
**Date context:** 2026-08  
**Mode:** Design review only — no SQL, no migrations, no application changes in this review.

---

## 1. Executive verdict

The architecture is a **strong foundation**: facts-vs-analytics separation, ingestion spine, medications≠treatments, supplies ledger, AI bounded context, timeline projection, and phased migrations are the right long-term bets for a health OS.

It is **not yet frozen**. Several decisions would create expensive debt under native multi-device sync, clinician/family tenancy, and multi-million-row wearable streams if SQL starts now.

**Freeze recommendation:** **No — not yet.**  
Complete the must-change list in §5, then freeze and implement.

---

## 2. Scores (1–10)

| Dimension | Score | Comment |
|-----------|------:|---------|
| Scalability | **6** | Model OK; HR/samples + timeline dual-write under-specified for year-5 volume |
| Maintainability | **7** | Clear bounded contexts; dual Reports/AI summary ownership and upsert-vs-immutable tension |
| Security | **7** | RLS + AI barrier directionally right; tenancy/grants and mechanical AI isolation incomplete |
| Data integrity | **6** | Fingerprints good; silent upsert overwrite conflicts with “immutable facts” principle |
| Offline capability | **6** | offline_queue + client_op_id present; multi-device convergence/CRDT rules thin |
| Cloud readiness | **8** | Supabase-shaped, phased flags, storage paths — strong |
| AI readiness | **7** | Tables + read-only rule good; enforcement + citation + outbox not sealed |
| Extensibility | **8** | Connectors/providers/treatments/supplies extend cleanly |
| Developer experience | **8** | Doc pack (esp. dictionary, events, API boundaries) is excellent SoT |
| Long-term technical debt | **5** | Deferred workspaces, overwrite semantics, no outbox, score-temptation risk → debt if frozen now |

*Higher is better for all except interpret “Long-term technical debt” as **debt resistance** (10 = little debt expected). Score 5 = moderate debt if frozen unchanged.*

---

## 3. Domain-by-domain challenge

### Identity & platform
- **Coupling:** `profiles.height_cm` vs measurement history will confuse ranges.  
- **RLS edge:** Soft-deleted profiles vs orphan facts.  
- **Must:** Plan `resource_grants` / nullable `workspace_id` before clinician portal.

### Ingestion & connected sources
- **Strength:** Single spine replaces “imports.”  
- **Risk:** Mapper versioning + fingerprint v2 not in schema yet.  
- **Risk:** Re-export Apple Health ZIP can fight user corrections without supersede model.

### Physiology / sleep / nutrition / training
- **Bottleneck:** `heart_rate_samples` in OLTP without mandatory partition/TSDB decision.  
- **Coupling:** Programmes vs treatments vs goals taxonomy still fuzzy at edges.  
- **Integrity:** Fingerprint upsert can overwrite history — violates freeze principle #1.

### Laboratory
- **Strength:** Catalog + panels/results.  
- **Risk:** AI interpretation columns creeping in — forbidden, must stay tested out.

### Medications / treatments / supplies
- **Strength:** Best product separation in the pack.  
- **Coupling:** dose_event ↔ inventory_transactions needs a single transactional command.  
- **Naming debt:** `inventory_transactions` under Supplies domain.

### Health events / photos / goals
- **Risk:** `health_events.metadata` JSON dump.  
- **Photos:** AI body-comp estimates must never become FACT.

### Timeline
- **Hidden coupling:** Dual-write from every command path → missed projections + latency.  
- **Fix:** Event outbox → async projector (exactly-once upsert on pointer).

### AI
- **Strength:** Separate tables; citations concept.  
- **Security:** Service-role workers are the classic foot-gun — needs allowlisted RPC matrix before code.  
- **DX:** AcceptRecommendation must be a clinical command bridge, not a tool write.

### Notifications / reports
- **Risk:** Weekly Review owned by both `reports` and `ai_summaries`.  
- **Spam/perf:** Queue dedupe mandatory.

### Analytics
- **Strength:** Explicitly non-SoT.  
- **Cultural risk:** Highest — teams will ask for score history tables under pressure; refuse.

---

## 4. Cross-cutting findings

| Area | Finding |
|------|---------|
| Hidden coupling | Timeline + notifications + AI tasks all wanting sync side effects on fact write |
| Unnecessary complexity | `beta_features` overlapping `feature_flags`; optional `dedup_keys` table |
| Migration risk | user_id-only RLS → workspace rewrite across ~80 tables |
| Scalability | HR/metrics; ai_embeddings; notification_history |
| Security | AI barrier, vault tokens, export/erase, future share grants |
| RLS edge cases | Soft-delete uniques; catalog tables; storage; grant escalation |
| Offline | revision vs supersede; clock skew; two-device dose double submit |
| Performance | Timeline keyset; fingerprint upsert; avoid realtime on samples |

---

## 5. Must change before implementation (freeze blockers)

1. **Immutable facts model** — Adopt supersede/invalid_at (or append-only revisions) for observations; ban silent in-place value overwrite. Align dictionary, sync, and commands (`CorrectWeight`, etc.).  
2. **Domain event outbox** — Add `domain_event_outbox` (PLATFORM) to the table list; timeline/notifications/AI subscribe from events, not ad-hoc dual-writes.  
3. **Tenancy seam** — Specify `resource_grants` (or equivalent) + RLS pattern now, even if unused until phase 9.  
4. **High-volume samples strategy** — Freeze decision: partitioned Postgres monthly **or** external time-series store for HR; do not leave ambiguous.  
5. **Partial unique indexes** — Fingerprints/uniques documented as `WHERE deleted_at IS NULL` (and invalid_at IS NULL).  
6. **Reports vs ai_summaries ownership** — One rule: e.g. `reports` shell + optional `ai_summary_id` body; WeeklyReviewGenerated once.  
7. **AI write-barrier matrix** — Table×operation allowlist doc section (security) as release-blocking test input.  
8. **Dose + inventory atomic command** — Single command boundary for dispense-on-take.  
9. **Rename** `inventory_transactions` → `supply_transactions` (or accept permanent mismatch — decide now).  
10. **Conflict policy freeze** — Elevate `22-sync-contracts.md` matrix to product-approved defaults (weight/sleep/workout/nutrition).  

Non-blocking but scheduled: merge beta into flags; add mapper_version on ingest_runs; GDPR export/erase commands in API boundaries (already sketched in DR).

---

## 6. Architectural rules — compliance check

| Rule | Status |
|------|--------|
| 1. Facts immutable / corrections as revisions | **Partial — blocker** |
| 2. Analytics never own data | **Compliant** (docs); needs cultural enforcement |
| 3. External SoT clear | **Compliant** via `22-sync-contracts.md` |
| 4. AI read-only to clinical facts | **Compliant** in intent; enforcement matrix missing |
| 5. Explainable recommendations | **Partial** — citations specified, not mandatory constraints |

---

## 7. If this were my startup — freeze?

### **No.**

I would **not** freeze and begin SQL migrations today.

I would spend a short architecture sprint (days, not months) to apply §5, update `07`, `19`, `05`, `03`, and `12` accordingly, then **freeze v1.1** and implement behind feature flags per `06-migrations-plan.md`.

After those changes, I **would** freeze: the bounded contexts, ingestion spine, and facts-vs-derived split are the correct 10-year backbone.
