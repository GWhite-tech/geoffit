# Geoffit Database Architecture — Performance

**Status:** Design only. Planning horizon: 5–10 years, ~thousands of users → tens of thousands; millions of fact rows per active user possible for HR/samples.

---

## 1. Largest tables (expected)

| Table | Year-5 rows (order) | Notes |
|-------|---------------------|-------|
| heart_rate_samples | 10⁹ global | Dominant; partition or external TSDB |
| metric_samples | 10⁸ | HRV, SpO2, etc. |
| timeline_entries | 10⁸ | One per notable fact |
| workout_sets | 10⁷–10⁸ | Strength users |
| ai_embeddings / ai_messages | 10⁷ | Growth with coach usage |
| notification_history | 10⁷ | Append |
| audit_log | 10⁷ | Append |
| inventory_transactions / dose_events | 10⁶–10⁷ | Ledgers |
| body_weight / sleep_sessions | 10⁶ | Moderate |
| blood_results | 10⁶ | Moderate |

---

## 2. Per-active-user rough annual volume

| Stream | Rows / user / year (heavy) |
|--------|----------------------------|
| HR samples (1Hz workouts + sparse day) | 1e5–5e6 |
| Weight | 200–1000 |
| Sleep sessions | ~365 |
| Workouts + sets | 200 workouts × ~40 sets ≈ 8k |
| Nutrition days | 365 |
| Doses | 1e3–5e3 |
| Timeline | 2e3–2e4 |

Design storage budgets around HR/metrics first.

---

## 3. Partition candidates

| Table | Strategy |
|-------|----------|
| heart_rate_samples | RANGE on `recorded_at` (monthly) + user_id indexes |
| metric_samples | RANGE monthly |
| notification_history | RANGE monthly |
| audit_log | RANGE monthly |
| ai_messages | RANGE or archive >18 months |
| domain_event_outbox (if added) | RANGE + delete after publish ack |
| timeline_entries | Consider RANGE yearly if >50M |

---

## 4. Projection tables (allowed)

| Projection | Purpose | Rebuild |
|------------|---------|---------|
| timeline_entries | Journey UI | From facts/events |
| Optional `daily_metric_rollups` | MC/charts | Nightly from samples |
| Optional `workout_session_stats` | Volume PRs | On WorkoutCompleted |

Rollups are **not** SoT; facts remain authoritative.

**Forbidden projections as SoT:** health_scores, mission_control_cards.

---

## 5. Materialized views

Use sparingly:

- Biomarker history per user (optional)  
- Expiring supply batches dashboard  
Avoid MV for scores — compute in app/workers with cache.

---

## 6. Cold storage

| Data | Hot | Cold |
|------|-----|------|
| raw_payloads | 30–90 days | Object archive / delete after replay confidence |
| HR samples > 24 months | Aggregates only | Partition detach → cheaper storage |
| AI embeddings | Active memories | Drop & rebuild |
| report PDFs | 90 days | Regen on demand |
| notification_history > 12 months | | Archive or purge |

---

## 7. Cache opportunities

| Cache | TTL | Invalidate on |
|-------|-----|---------------|
| Mission Control snapshot | 30–300s | WeightRecorded, Sleep*, Workout*, etc. |
| Scores | 60–300s | Same |
| Timeline first page | 30–60s | Timeline projection |
| Feature flags | 30–60s | Admin change |
| Signed file URLs | minutes | N/A |
| AI retrieval chunks | short | Memory change |

Prefer Redis/edge cache; not Postgres as score warehouse.

---

## 8. Query hot paths

1. Timeline keyset page (`user_id, occurred_at DESC`)  
2. Latest weight / sleep / next dose (Mission Control)  
3. Workout list + last N sessions  
4. Marker history sparkline  
5. Sync pull: facts since cursor + tombstones  
6. Ingest upsert by fingerprint  
7. Notification queue drain  
8. AI thread message page  

Index these first (see `08-indexes.md`, `19-data-dictionary.md`).

---

## 9. Write path risks

| Risk | Mitigation |
|------|------------|
| Timeline dual-write in request | Outbox → async projector |
| Per-row HR inserts | Bulk copy / batched ingest |
| Fingerprint unique conflicts storm | Idempotent upsert; metrics |
| RLS seq scans | Composite indexes leading with user_id |
| Realtime on huge tables | Realtime only doses/messages/queue — never HR |

---

## 10. Multi-tenant scale notes

- Thousands of users is fine on one Postgres with partitions.  
- Millions of users → pooler, read replicas for queries, isolate AI embeddings, consider TSDB for HR.  
- Clinician portal: grant-scoped queries must not full-scan all users’ labs.
