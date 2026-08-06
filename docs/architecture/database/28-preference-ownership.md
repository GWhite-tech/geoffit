# Preference Ownership Model

**Status:** Canonical  
**App SoT (presentation):** `lib/preferences/types.ts`  
**Table SoT:** `docs/architecture/database/19-data-dictionary.md` §1.2  

---

## Rule

Each preference class has **exactly one** owning table. Do not mirror the same setting across `profiles`, `user_preferences`, and domain tables.

---

## Ownership map

| Concern | Owner | Shape | Notes |
|---------|-------|-------|-------|
| Identity (name, email cache, DOB, sex, height, avatar file) | `profiles` | 1:1 with `auth.users` | No theme/units/timezone/locale |
| Presentation / UX (theme, accent, units, timezone, locale, date/week, dashboard layout, unit overrides, font/density, onboarding gate) | `user_preferences` | **One typed row per user** | Check-constrained enums |
| Notification channels, quiet hours, categories | `notification_preferences` (+ rules) | Future (Phase 6) | Not in `user_preferences` |
| Privacy level / export policy | Dedicated privacy table (future) | TBD | Not in `user_preferences` |
| AI coach style / memory “preferences” | `ai_memory` / AI domain | Future (Phase 7) | User-approved memories ≠ UX prefs |
| Source priority, merge mode, primary sleep source | Ingestion / sync preference tables or source config (future) | TBD | Sync contracts; not UX row |
| Feature rollout | `feature_flags` + `user_feature_access` | Platform | Not user settings UI |

---

## `user_preferences` contract

- **Cardinality:** `UNIQUE (user_id)` — never key/value EAV  
- **Mutability:** patch/upsert whole row or column subset  
- **RLS:** `user_id = auth.uid()`  
- **Bootstrap:** `handle_new_user` inserts defaults from auth metadata (`theme`, `units`, optional `timezone`/`locale`)  
- **Canonical TypeScript:** `UserPreferences` in `lib/preferences/types.ts`

### Explicit non-columns

Do **not** add to `user_preferences`:

- `notifications_*`, `email_notifications`, `push_notifications`, `marketing_emails`
- `privacy_level` / consent flags
- AI coach toggles / model choices
- `source_priority`, `merge_mode`, sleep primary provider

---

## Profiles vs preferences

```text
profiles          → who the user is (identity + clinical headers)
user_preferences → how the product presents to them (UX)
```

Day-boundary timezone and locale for formatting live on **`user_preferences`**. Reminder quiet-hour timezone overrides may later live on `notification_preferences` without duplicating the primary UX timezone.

---

## API surface

| Operation | Meaning |
|-----------|---------|
| `GetPreferences` | Load the single typed row |
| `PatchPreferences` | Partial update of typed columns |
| `GetProfile` / `UpdateProfile` | Identity fields only |

---

## Migration history

Provisional key/value `user_preferences (key, value jsonb)` was rejected before production data and replaced by the typed one-row model in Phase 1 SQL.
