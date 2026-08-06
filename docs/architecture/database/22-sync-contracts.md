# Geoffit Database Architecture — Sync Contracts

**Status:** Design only. Binding product rules for connectors.  
**Spine:** All connectors terminate in Ingestion → FACT upserts → domain events. No parallel schemas.

---

## 0. Global contract rules

| Topic | Rule |
|-------|------|
| Ownership | User owns Geoffit facts; providers own their remote graphs |
| Geoffit SoT | Canonical FACT tables inside Geoffit for the product |
| Provider SoT | Remote system remains authoritative **for fields it owns** until user locks/manual overrides |
| Sync direction | Default **inbound** (provider → Geoffit). Outbound only if explicitly productized later |
| Duplicates | Fingerprint / external_id upsert; never double-count in UI preferences |
| Deletions | Provider delete → tombstone when trusted; else mark inactive; never hard-delete ledgers |
| Versioning | `revision` + fingerprint; corrections prefer new fact / supersede (see readiness) |
| Conflicts | Field-level ownership matrix + `conflict_records` when unresolvable |
| Frequency | Per `connected_sources.sync_frequency` + provider rate limits |
| Auth | Tokens in Vault via `sync_token_ref` only |

### Field ownership merge (workouts example)

| Field group | Owner when both Hevy + Apple Health exist |
|-------------|-------------------------------------------|
| Exercise/set structure | Hevy |
| HR / calories / route | Wearable / Apple Health / Garmin |
| Title | Hevy if present else AH |
| Manual lock | User wins (`locked_at` / `is_manual`) |

---

## 1. Apple Health

| Topic | Contract |
|-------|----------|
| Ownership | Apple Health / HealthKit on device; Geoffit stores mapped facts |
| Source of truth | For sleep/steps/HR samples when user preference selects AH; weight often merge_all |
| Direction | Inbound (export upload v1; background incremental later) |
| Frequency | User-triggered export; later OS delivery / periodic pull |
| Duplicates | UUID/sourceRevision → fingerprint; re-export safe |
| Deletions | If incremental delete signals exist, tombstone; ZIP re-import does not resurrect voided manual locks |
| Conflicts | Prefer preference (`is_primary` for sleep); weight merge_all keeps multiple sources queryable |
| Versioning | HealthKit sync anchors in `sync_state` |
| Notes | Background sync must use same mappers as ZIP path |

---

## 2. Health Connect (Android)

| Topic | Contract |
|-------|----------|
| Ownership | On-device aggregate store |
| SoT | Same fact tables as AH; `provider=health_connect` |
| Direction | Inbound |
| Frequency | Periodic + change tokens in `sync_state` |
| Duplicates | Record uid → fingerprint |
| Deletions | Honor HC deletions when API provides |
| Conflicts | Same preference engine as iOS |
| Versioning | Per-datatype read checkpoints |

---

## 3. Hevy

| Topic | Contract |
|-------|----------|
| Ownership | Hevy owns workout structure remotely |
| Geoffit SoT | `workouts` / exercises / sets for in-app training |
| Direction | Inbound API; outbound create/update **not** in v1 |
| Frequency | Hourly or on-open; webhook later if available |
| Duplicates | `external_ids.hevy` unique per user |
| Deletions | Remote delete → soft delete local + tombstone |
| Conflicts | Structure: Hevy wins unless `locked_at`; physiology from wearables may attach |
| Versioning | API updated_at / etag in `sync_state` |

---

## 4. Withings

| Topic | Contract |
|-------|----------|
| Ownership | Withings cloud for scale/sleep devices |
| Geoffit SoT | body_weight, body_composition, sleep_sessions |
| Direction | Inbound OAuth |
| Frequency | Hourly default; notify if webhook |
| Duplicates | measure grp id → fingerprint |
| Deletions | Rare; tombstone if confirmed |
| Conflicts | Sleep: product prefers Withings when enabled (`is_primary`); weight: merge_all |
| Versioning | `lastupdate` cursor in `sync_state` |

---

## 5. Cronometer

| Topic | Contract |
|-------|----------|
| Ownership | Cronometer diary remotely |
| Geoffit SoT | nutrition_days / meals |
| Direction | Inbound |
| Frequency | Daily + on-demand |
| Duplicates | day+source / entry id fingerprint |
| Deletions | Mirror soft delete |
| Conflicts | Multi-source days allowed; UI picks primary |
| Versioning | Diary date watermark |

---

## 6. MyFitnessPal

| Topic | Contract |
|-------|----------|
| Ownership | MFP diary |
| Geoffit SoT | nutrition_days / meals |
| Direction | Inbound (export or API if available) |
| Frequency | Daily / on-demand |
| Duplicates | entry fingerprints |
| Deletions | Soft delete when detected |
| Conflicts | Same as Cronometer (primary flag) |
| Versioning | Export batch id / API cursor |
| Risk | API access unstable — design CSV path as first-class |

---

## 7. Garmin (future)

| Topic | Contract |
|-------|----------|
| Ownership | Garmin Connect |
| Geoffit SoT | workouts, sleep, steps, HR, metric_samples |
| Direction | Inbound |
| Frequency | Hourly; respect Garmin quotas |
| Duplicates | activityId fingerprints |
| Deletions | Tombstone on delete notification |
| Conflicts | Activity structure vs AH HR merge rules |
| Versioning | summary timestamp cursors |

---

## 8. Polar (future)

| Topic | Contract |
|-------|----------|
| Ownership | Polar AccessLink |
| Geoffit SoT | workouts, sleep, HR, metrics |
| Direction | Inbound |
| Frequency | Daily / hourly |
| Duplicates | polar exercise id |
| Deletions | Tombstone |
| Conflicts | Same merge matrix as Garmin |
| Versioning | transaction / cursor tokens |

---

## 9. WHOOP (future)

| Topic | Contract |
|-------|----------|
| Ownership | WHOOP cloud |
| Geoffit SoT | sleep, workouts/strain proxies → metric_samples; **not** Recovery Score as FACT |
| Direction | Inbound |
| Frequency | Hourly |
| Duplicates | cycle/sleep ids |
| Deletions | Tombstone |
| Conflicts | Sleep primary preference may choose WHOOP |
| Versioning | API cursors |
| Explicit | WHOOP Recovery/Strain scores = analytics inputs or transient — **not** SoT tables |

---

## 10. Oura (future)

| Topic | Contract |
|-------|----------|
| Ownership | Oura cloud |
| Geoffit SoT | sleep, readiness-related **samples** if raw; not “Readiness Score” SoT |
| Direction | Inbound |
| Frequency | Daily morning + hourly |
| Duplicates | sleep period ids |
| Deletions | Tombstone |
| Conflicts | Sleep preference |
| Versioning | document version / cursor |

---

## 11. Fitbit (future)

Same pattern as Garmin: inbound activities/sleep/HR → facts; scores stay derived.

---

## 12. CSV / Manual

| Topic | Contract |
|-------|----------|
| Ownership | User |
| SoT | Geoffit facts immediately |
| Direction | Inbound file / UI commands |
| Frequency | On demand |
| Duplicates | Row fingerprint from normalized values + day |
| Deletions | User soft delete |
| Conflicts | Manual/locked beats connectors |
| Versioning | ingest_run_id lineage |

---

## 13. Conflict policy matrix (product defaults)

| Domain | Default winner |
|--------|----------------|
| Weight | Keep all sources; charts use preference (`merge_all` / single source) |
| Sleep nightly primary | User preference (e.g. Withings > Oura > AH) |
| Workout structure | Hevy > Garmin > AH |
| Workout physiology | Wearable with densest HR |
| Nutrition day primary | User preference |
| Meds / doses | Manual / Geoffit only (no silent remote overwrite) |
| Labs | Manual/PDF import wins; no wearable overwrite |

---

## 14. Deletion & GDPR interplay

Connector disconnect does **not** delete facts by default (user data retention).  
Optional “remove data from source X” command soft-deletes facts with that `source_id` + tombstones + event `SourceDataPurged`.
