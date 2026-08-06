# Geoffit Database Architecture — Bounded Contexts

## Map

```text
┌─────────────┐   ┌──────────────┐   ┌─────────────┐
│  Platform   │   │  Identity    │   │ Ingestion   │
│ flags/audit │   │ profiles     │   │ sources/sync│
└──────┬──────┘   └──────┬───────┘   └──────┬──────┘
       │                 │                  │ facts in
       ▼                 ▼                  ▼
┌──────────────────────────────────────────────────┐
│              Health Facts (canonical)            │
│ body · sleep · nutrition · training · labs       │
│ medications · treatments · supplies · events     │
│ photos · goals · journal                         │
└───────────────────────┬──────────────────────────┘
                        │ read / project
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   Timeline        Analytics*      Reports/AI*
   (index)         (engines)       (derived store)
                        │               │
                        └───────┬───────┘
                                ▼
                         Notifications
```

\* Analytics engines are **application services**, not permanent fact stores. Reports/AI may persist regenerable artifacts.

## Context catalogue

| Context | Owns | Does not own |
|---------|------|--------------|
| **Platform** | Flags, experiments, audit, files meta | Clinical facts |
| **Identity** | Profiles, preferences, future workspaces | Health scores |
| **Ingestion** | Sources, runs, payloads, sync, queues | Clinical interpretation |
| **Physiology** | Weight, composition, metrics, HR, steps | Scores |
| **Sleep** | Sessions, stages | Recovery score |
| **Nutrition** | Targets, days, meals | Diet narratives |
| **Training** | Workouts, programmes, completions | Training score |
| **Laboratory** | Panels, results, biomarker catalog | Doctor letters (→ Reports) |
| **Medications** | Products, schedules, doses, Rx | Treatment programmes |
| **Treatments** | Interventions, milestones, events | Drug product catalog |
| **Supplies** | Catalog, batches, ledger, locations | Dose adherence logic |
| **Health Events** | Illness, injury, diagnosis, life events | AI opinions |
| **Photos** | Progress photos + capture metadata | Body-comp AI estimates (derived) |
| **Goals & Journal** | Goals, checkpoints, journal | Achievement engines (derived) |
| **Timeline** | Chronological index/projection | Duplicated payloads |
| **AI** | Threads, memory, tasks, recs, summaries | Clinical mutations |
| **Notifications** | Prefs, rules, queue, history | Fact creation (except via user action) |
| **Reports** | Scheduled/generated documents | Source facts |

## Anti-corruption rules

1. **Ingestion → Facts:** mappers produce fact rows; never write AI or scores.  
2. **AI → Facts:** read-only; user confirmation creates new fact rows via domain APIs.  
3. **Reports → Facts:** read-only snapshots of fact queries + optional AI text.  
4. **Timeline → Facts:** stores pointers (`entity_type` + `entity_id`), not copies.  
5. **Medications ↛ Treatments:** link table only; distinct aggregates.  
6. **Supplies ↛ Medications:** a supply batch may *relate* to a medication product; dose events remain Meds domain.

## Integration style

- Synchronous: user CRUD within one context  
- Asynchronous: ingest completion → fact upsert → timeline project → notification evaluate → optional AI task enqueue  
- No shared DB transactions across AI write + clinical write in one auto-commit from the model  

## Ubiquitous language (selected)

| Term | Meaning |
|------|---------|
| Fact | Observed or user-asserted health datum |
| Derived | Regenerable computation or AI artifact |
| Ingest run | One attempt to pull/parse external or file data |
| Treatment | Intervention programme, not a pill |
| Supply | Physical stock item (med vial, kit, protein) |
| Timeline entry | Indexed moment on the journey |
