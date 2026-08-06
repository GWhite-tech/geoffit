# Database

Production database architecture lives in:

**[docs/architecture/database/](./architecture/database/)**

Start with [`01-overview.md`](./architecture/database/01-overview.md).

**Phase 1 SQL** (platform foundation): [`architecture/database/migrations/phase-1.md`](./architecture/database/migrations/phase-1.md) — forward / rollback / verify under `supabase/migrations/`.

**Preference ownership:** [`architecture/database/28-preference-ownership.md`](./architecture/database/28-preference-ownership.md)

| Doc | Topic |
|-----|--------|
| [01-overview](./architecture/database/01-overview.md) | Facts-first overview |
| [02-entities](./architecture/database/02-entities.md) | Entity catalogue |
| [03-erd](./architecture/database/03-erd.md) | Mermaid ERD |
| [04-sync-strategy](./architecture/database/04-sync-strategy.md) | Ingestion & sync |
| [05-security](./architecture/database/05-security.md) | Auth, RLS, AI barriers |
| [06-migrations-plan](./architecture/database/06-migrations-plan.md) | Phased rollout |
| [07-table-list](./architecture/database/07-table-list.md) | Full table list |
| [08-indexes](./architecture/database/08-indexes.md) | Indexes |
| [09-storage](./architecture/database/09-storage.md) | Object storage |
| [10-future](./architecture/database/10-future.md) | Longer horizon |
| [11-bounded-contexts](./architecture/database/11-bounded-contexts.md) | Bounded contexts |
| [12-domain-map](./architecture/database/12-domain-map.md) | Facts vs generated |
| [13-event-flow](./architecture/database/13-event-flow.md) | Event flows |
| [14-timeline](./architecture/database/14-timeline.md) | Health timeline |
| [15-ai-architecture](./architecture/database/15-ai-architecture.md) | AI domain |
| [16-platform](./architecture/database/16-platform.md) | Feature flags |
| [17-notifications](./architecture/database/17-notifications.md) | Notifications |
| [18-connected-sources](./architecture/database/18-connected-sources.md) | Connected sources |
| [19-data-dictionary](./architecture/database/19-data-dictionary.md) | Field-level SoT for migrations/APIs |
| [20-domain-events](./architecture/database/20-domain-events.md) | Domain events |
| [21-api-boundaries](./architecture/database/21-api-boundaries.md) | Commands / Queries / Events |
| [22-sync-contracts](./architecture/database/22-sync-contracts.md) | External sync contracts |
| [23-versioning](./architecture/database/23-versioning.md) | Schema evolution |
| [24-performance](./architecture/database/24-performance.md) | Performance & scale |
| [25-disaster-recovery](./architecture/database/25-disaster-recovery.md) | DR & data rights |
| [26-testing-strategy](./architecture/database/26-testing-strategy.md) | Database testing strategy |
| [27-architecture-readiness](./architecture/database/27-architecture-readiness.md) | Freeze-gate readiness report |
| [28-preference-ownership](./architecture/database/28-preference-ownership.md) | Who owns which preferences |
| [29-product-principles](./architecture/database/29-product-principles.md) | Product principles |
| [migrations/phase-1](./architecture/database/migrations/phase-1.md) | Phase 1 SQL apply guide |
| [migrations/storage-ingest-uploads](./architecture/database/migrations/storage-ingest-uploads.md) | Direct Storage upload pipeline (blood PDFs) |
| [migrations/document-ingestion-framework](./architecture/database/migrations/document-ingestion-framework.md) | Pluggable document ingestion spine |
