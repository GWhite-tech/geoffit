# Geoffit Database Architecture — Disaster Recovery & Data Rights

**Status:** Design only.

---

## 1. Backups

| Layer | Policy (target) |
|-------|-----------------|
| Postgres (Supabase) | Daily full + continuous WAL / PITR ≥ 30 days (confirm plan tier) |
| Object Storage | Versioning + cross-region replication for clinical buckets |
| Vault secrets | Independent backup / provider HA |
| Edge config | Infra-as-code; rebuildable |

**RPO target:** ≤ 15 minutes (PITR).  
**RTO target:** ≤ 4 hours for primary region restore (improve over time).

---

## 2. Restore strategy

1. Stop writers (maintenance flag).  
2. Restore DB to PITR timestamp.  
3. Reconcile Storage (versioned objects) to same window.  
4. Replay `domain_event_outbox` / failed jobs cautiously (idempotent consumers).  
5. Recompute derived: timeline gaps, AI embeddings optional, reports on demand.  
6. Validate RLS + sample user checksums (weight count, latest dose).  
7. Re-enable writers.

Never restore Production over a newer Production without executive decision — prefer clone → verify → cutover.

---

## 3. Accidental deletion

| Case | Recovery |
|------|----------|
| Soft-deleted fact | Undelete (`deleted_at = null`) + remove tombstone + event |
| Voided dose/ledger | Leave void; add compensating entry |
| Hard delete (bug) | PITR or backup row extract → insert as revision |
| Wiped timeline | Rebuild from facts (`RebuildTimeline`) |
| Deleted raw_payload | Re-fetch from provider if cursor allows; else user re-upload |

**Prevention:** no hard DELETE grants for clients; service role audited; soft delete default.

---

## 4. User export

Command: `ExportUserData`.

Package includes:

- All FACT tables for user  
- Ingest metadata (not necessarily raw blobs if expired — include if present)  
- AI threads/memory (user-selectable)  
- Reports/exports list + available PDFs  
- Timeline can be regenerated — optional include  
- Manifest with schema version + generated_at  

Format: ZIP of JSON/CSV + files. Event: `UserExportReady`.

---

## 5. GDPR / right to erasure

Command: `EraseUserData` (verified identity).

| Data | Action |
|------|--------|
| Facts, AI, reports, files | Hard delete or irreversible anonymize |
| audit_log | Retain minimal legal trail without clinical payload where required |
| backups | Expire via retention; do not actively surgically edit WAL |
| Connected source tokens | Revoke + delete refs |
| Derived caches | Purge |

Emit `UserErased`. Block AI/analytics from retaining copies outside DB.

---

## 6. Import / ingest replay

If facts corrupted but `raw_payloads` exist:

1. Mark bad facts soft-deleted (or supersede).  
2. Re-run mapper at `mapper_version` N on payload.  
3. Idempotent fingerprint upsert.  
4. Rebuild timeline.  
5. Invalidate analytics caches.

If payloads GC’d: pull provider again from `sync_state` cursor reset (document data-loss window to user).

---

## 7. Region / provider outage

| Outage | Mode |
|--------|------|
| Supabase API | Offline-first clients queue; show degraded cloud banner |
| Single connector | Other sources continue; `SourceAuthFailed` / sync pause |
| LLM provider | AI tasks fail soft; facts unaffected |
| Storage | Block photo/lab upload; facts without blobs continue |

---

## 8. Corruption detection

- Periodic row-count / checksum jobs per user sample  
- Ledger invariant: sum(transactions) ≈ batch quantity  
- Orphan timeline pointers detector  
- RLS negative tests in CI  

---

## 9. Runbooks (titles only)

1. PITR restore to staging  
2. User undelete last 24h  
3. Connector token mass revoke  
4. GDPR erase  
5. Reprocess Apple Health payload  
6. Timeline full rebuild  
7. Partition attach/detach HR samples  
