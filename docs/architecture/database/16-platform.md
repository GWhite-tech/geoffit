# Geoffit Database Architecture — Platform Domain

## Purpose

Cross-cutting product infrastructure: identity glue, feature rollout, audit, file metadata. Not clinical meaning.

## Tables

### `feature_flags`
key, description, default_enabled, rollout_percentage (0–100), status (draft/active/retired), targeting metadata.

### `beta_features`
Optional catalog of beta programmes; may merge into `feature_flags` with `channel=beta`. Kept distinct if marketing/ops needs a separate list.

### `experiments`
A/B or multivariate: key, variants JSON, allocation, start/end, status.

### `user_feature_access`
Per-user overrides: user_id, flag_key, enabled, reason (support grant, beta invite), expires_at.

### Evaluation order (intent)

```text
1. user_feature_access override (if present and unexpired)
2. experiment assignment (sticky)
3. feature_flags.rollout_percentage (stable hash of user_id + key)
4. flag default_enabled
```

### Related platform tables

| Table | Role |
|-------|------|
| profiles | Identity extension |
| user_preferences | Typed 1:1 UX/presentation prefs (units, theme, locale) — not source/notif/privacy |
| audit_log | Security/compliance trail |
| user_files | Blob metadata |
| workspaces* | Future tenancy |

## Use in migrations

Every domain cutover from local → cloud should be behind a flag (`cloud.body_weight`, `cloud.medications`, …) so rollback does not require schema drop.

## Security

- Flag definitions: authenticated read; admin/service write  
- Overrides: service/admin or privileged RPC  
- Never store secrets in flag JSON  

## What Platform does not store

Health scores, AI clinical conclusions, or duplicate facts.
