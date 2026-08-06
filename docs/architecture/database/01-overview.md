# Geoffit Database Architecture — Overview

**Status:** Design only (no SQL, no migrations)  
**Baseline revision:** Facts-first platform model (post refinement)  
**Target:** Supabase / Postgres — multi-year production SaaS

---

## 1. Purpose

Geoffit is a cloud-first **health operating system**. The database is the durable home for **canonical health facts** and **platform machinery** (identity, ingestion, notifications, files, flags).

It is **not** a warehouse of UI cards, scores, or AI essays. Those are produced by analytics engines and may be cached ephemerally or stored only as **explicitly derived artifacts** (reports, AI summaries) that can be regenerated from facts.

---

## 2. Non-negotiable: facts vs analytics

### 2.1 Canonical health facts (persist)

Factual, attributable, time-stamped observations and user-declared clinical/life events:

| Domain | Examples |
|--------|----------|
| Body | Weight, composition sessions, tape measurements |
| Sleep | Sessions, stages |
| Activity | Workouts, sets, steps, cardio detail |
| Nutrition | Days, meals, targets (as user/config facts) |
| Lab | Panels, marker values |
| Medications | Drug products, schedules, dose events |
| Treatments | Non-drug interventions (programmes of care) |
| Supplies | Batches, transactions, expiry |
| Events | Illness, injury, diagnosis, vaccination |
| Photos | Progress photos + capture metadata |
| Journal | User-authored notes |
| Goals | Declared targets (not computed progress narratives) |

### 2.2 Derived / generated (do **not** treat as source of truth)

| Output | Produced by | Persistence policy |
|--------|-------------|-------------------|
| Health / Training / Recovery scores | Analytics engines | **Transient** — compute on read or short TTL cache only |
| Mission Control cards | Analytics engines | **Transient** |
| Progress narratives / correlations | Analytics engines | **Transient** |
| Weekly Review *content* (scores, story) | Weekly Review engine | **Not a fact table** — may appear as a **Report** or **AI summary** artifact if the user saves/exports it |
| AI conclusions / recommendations | AI domain | Stored in AI tables as **derived**, never written back into clinical fact tables |

**Rule:** Analytics and AI **read** facts. They **never mutate** medications, labs, doses, weights, or other clinical facts (except via explicit user-confirmed actions that create *new* fact rows).

See `12-domain-map.md` for the full facts vs generated matrix.

---

## 3. Design philosophy

| Principle | Meaning |
|-----------|---------|
| **Facts first** | OLTP stores reality; engines project insight |
| **User ownership** | Personal rows carry `user_id`; RLS everywhere |
| **Ingestion, not “imports”** | All connectors share one ingest spine |
| **Source-agnostic core** | Apple Health, Health Connect, Hevy, Withings, … map into the same fact tables |
| **Typed hot paths** | Weight, sleep, workouts, labs, meds get first-class tables |
| **Narrow samples** | Dense streams use dedicated sample tables |
| **Timeline as journey index** | Chronological UX without duplicating payloads |
| **AI is a bounded context** | Own tables, own policies, no clinical writes |
| **Supplies, not “pills left”** | Ledger + batches + locations |
| **Medications ≠ Treatments** | Products vs interventions |
| **Sync-ready** | Fingerprints, cursors, failures, offline/retry queues |
| **Platform controls rollouts** | Feature flags / experiments |

---

## 4. Bounded contexts (summary)

Full detail: `11-bounded-contexts.md`.

1. **Identity & access** — profiles, preferences, future workspaces  
2. **Connected sources & ingestion** — sources, ingest runs, payloads, sync, queues  
3. **Physiology facts** — body, samples, HR, steps  
4. **Sleep facts**  
5. **Activity & training facts** — workouts, programmes (as plans), completions  
6. **Nutrition facts**  
7. **Laboratory facts**  
8. **Medications** — pharmaceutical products & dosing  
9. **Treatments** — interventions / programmes of care  
10. **Supplies** — inventory of consumables & equipment  
11. **Health events** — illness, injury, diagnosis, life events  
12. **Photos** — progress photography  
13. **Goals & journal** — declared goals, user notes (achievements may be derived—*see domain map*)  
14. **Timeline** — chronological index over facts + derived markers  
15. **AI** — threads, memory, embeddings, tasks, recommendations, summaries, feedback  
16. **Notifications** — prefs, rules, queue, history, templates  
17. **Reports** — generated documents & schedules (derived artifacts)  
18. **Platform** — feature flags, experiments, audit  

---

## 5. Layered data model

```
┌──────────────────────────────────────────────────────────────┐
│  PRESENTATION / ENGINES (app memory, short TTL, not SoT)      │
│  Mission Control · Progress · Scores · Live Weekly Review UI │
├──────────────────────────────────────────────────────────────┤
│  DERIVED ARTIFACTS (optional durable, regenerable)            │
│  reports · ai_summaries · ai_recommendations · timeline ptrs │
├──────────────────────────────────────────────────────────────┤
│  CANONICAL HEALTH FACTS                                       │
│  body · sleep · workouts · nutrition · labs · meds · …       │
├──────────────────────────────────────────────────────────────┤
│  INGESTION & CONNECTIVITY                                     │
│  connected_sources · ingest_runs · raw_payloads · sync_*     │
├──────────────────────────────────────────────────────────────┤
│  IDENTITY & PLATFORM                                          │
│  profiles · preferences · feature_flags · audit_log          │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Why this shape lasts

- **Connectors change**; fact tables stay stable.  
- **Analytics evolve weekly**; regenerating scores does not require migrations.  
- **AI grows** without polluting clinical schema.  
- **Timeline** makes “health journey” a first-class query path for product + AI grounding.  
- **Supplies** scales from peptides to test kits and protein without a second inventory product.  
- **Feature flags** allow cloud cutover per domain without big-bang risk.

---

## 7. Document map

| Doc | Topic |
|-----|--------|
| `01-overview.md` | This file |
| `02-entities.md` | Entity catalogue |
| `03-erd.md` | Mermaid ERD |
| `04-sync-strategy.md` | Ingestion & sync |
| `05-security.md` | Auth, RLS, AI write barriers |
| `06-migrations-plan.md` | Phased rollout |
| `07-table-list.md` | Full table list |
| `08-indexes.md` | Indexes |
| `09-storage.md` | Buckets |
| `10-future.md` | Longer horizon |
| `11-bounded-contexts.md` | Context deep-dive |
| `12-domain-map.md` | Facts vs generated matrix |
| `13-event-flow.md` | End-to-end flows |
| `14-timeline.md` | Timeline architecture |
| `15-ai-architecture.md` | AI domain |
| `16-platform.md` | Flags & experiments |
| `17-notifications.md` | Notifications |
| `18-connected-sources.md` | Sources catalogue |
| `19-data-dictionary.md` | Field-level SoT for migrations/APIs |
| `20-domain-events.md` | Technology-agnostic domain events |
| `21-api-boundaries.md` | Commands / Queries / Events per domain |
| `22-sync-contracts.md` | External source contracts |
| `23-versioning.md` | Schema & client evolution |
| `24-performance.md` | Scale, partitions, hot paths |
| `25-disaster-recovery.md` | Backup, restore, GDPR |
| `26-testing-strategy.md` | RLS, sync, AI safety, offline tests |
| `27-architecture-readiness.md` | Freeze-gate readiness report |
| `29-product-principles.md` | Non-negotiable product principles |

---

## 8. Explicit non-goals (this phase)

- SQL / Supabase migrations / Prisma  
- Migrating IndexedDB data  
- Implementing analytics engines in the database (no stored “Health Score” table as SoT)
