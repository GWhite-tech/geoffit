# Geoffit Design System — Phase 2 (Mobile-first)

Premium consumer health app. Dark mode first. Information hierarchy over card chrome.

## Layout

- Target content width: **390px** (iPhone 16 Pro)
- Safe-area insets on top/bottom
- **Mobile:** bottom navigation (5 tabs)
- **Desktop (`md+`):** sidebar + content (same pages, adaptive)

### Bottom tabs

Mission Control · Progress · Blood · Training · Account

Scroll position is restored per tab via `hooks/use-tab-scroll-restoration.ts`.

## Components (`components/mobile/`)

| Component | Role |
|-----------|------|
| `MobilePage` | Page scaffold / large titles |
| `HealthScore` | Hero score + trend + summary |
| `MetricCard` | Compact today’s metric |
| `SectionHeader` | Section title + optional action |
| `TrendBadge` | ↑ ↓ → with semantic colour |
| `InsightCard` | Soft insight surface |
| `QuickAction` | Pill action |
| `BiomarkerCell` | Blood list row |
| `FloatingActionButton` | Primary mobile action |

## Colour

- Neutral surfaces and typography
- Status only: **green** / **amber** / **red**
- Avoid decorative purple washes on chrome

## Motion

Subtle fades and number springs (`CountUp`). No excessive motion.
