# Geoffit Database Architecture — AI Domain

## Bounded context

AI is its own bounded context. It **reads** health facts and **writes only** AI tables (and optional derived timeline markers). It **never** mutates clinical fact rows.

## Tables

### `ai_threads`
Conversation containers: user_id, title, status, context_scope (e.g. labs, training), created/updated.

### `ai_messages`
role (user/assistant/system/tool), thread_id, content, model, token usage, citations (fact pointers), created_at.

### `ai_memory`
Long-lived user-approved memories: kind (preference, constraint, goal_context), content, confidence, source_thread_id, active flag. User-deletable. Not clinical SoT.

### `ai_embeddings`
Vectors for retrieval over memories, journal snippets, or summary chunks. References `owner_type` + `owner_id`. pgvector. Regenerable.

### `ai_tasks`
Async jobs: summarize week, explain panel, compare photos. status, payload, error, next_run_at. Output lands in messages/summaries/recommendations — not fact tables.

### `ai_recommendations`
Structured suggestions: type, title, body, status (pending/accepted/dismissed), related_entity pointers, expires_at. Acceptance triggers **user-confirmed** domain APIs.

### `ai_summaries`
Period summaries (week/month), doctor-prep blurbs. Regenerable DERIVED. May attach to `reports` or stand alone.

### `ai_feedback`
Thumbs / corrections on recommendations or messages — improves product, not clinical DB.

## Interaction with facts

```text
┌────────────┐  SELECT only   ┌──────────┐
│ Fact tables│ ◄──────────────│ AI runtime│
└────────────┘                └────┬─────┘
                                   │ INSERT/UPDATE
                                   ▼
                              ai_* tables
                                   │
                     user accepts recommendation
                                   ▼
                         Domain API → NEW facts
```

## Citation model

Messages/recommendations should store **pointers** (`entity_type`, `entity_id`) to facts used, so the UI can show provenance without embedding mutable copies of labs into AI tables as SoT.

## Write barrier (enforcement intent)

1. RLS + RPC whitelist: AI service role paths cannot UPDATE fact tables.  
2. “Apply recommendation” is a separate authenticated mutation in Meds/Treatments/Goals/etc.  
3. Audit log when a recommendation leads to a fact create.  

## Timeline & reports

- Saved `ai_summaries` → optional `timeline_entries` (`ai_summary`).  
- Weekly Review text may live in `ai_summaries` and/or `reports` — both DERIVED.  

## What AI must not permanently own

| Anti-pattern |
|--------------|
| Columns on `blood_results` for “AI interpretation” as SoT |
| Overwriting weight because model “corrected” Withings |
| Storing Health Score as AI memory |

## Scalability

- Embeddings and messages grow fast → partition/archive; TTL on embeddings rebuildable from source text.  
- Tasks queue should be bounded; prefer idempotent task keys.  
