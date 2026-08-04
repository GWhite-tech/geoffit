"use client"

import { AdvancedPanel } from "@/components/settings/advanced-panel"
import { AboutPanel } from "@/components/settings/about-panel"
import { DataSourcesPanel } from "@/components/settings/data-sources-panel"
import { IntegrationsPanel } from "@/components/settings/integrations-panel"
import { PreferenceField } from "@/components/settings/preference-field"
import {
  getCategory,
  preferencesForCategory,
  type PreferenceDefinition,
  type SettingsCategoryId,
  type SettingsSearchHit,
} from "@/lib/settings"

export function SettingsPanel({
  category,
  searchHits,
  searchQuery,
  onJumpCategory,
}: {
  category: SettingsCategoryId
  searchHits: SettingsSearchHit[]
  searchQuery: string
  onJumpCategory: (id: SettingsCategoryId) => void
}) {
  if (searchQuery.trim()) {
    return (
      <SearchResults
        hits={searchHits}
        query={searchQuery}
        onJumpCategory={onJumpCategory}
      />
    )
  }

  const meta = getCategory(category)

  return (
    <div className="mx-auto w-full max-w-[760px] px-6 py-10 lg:px-12">
      <header className="mb-12">
        <h1 className="text-[32px] font-semibold tracking-tight text-foreground">
          {meta?.label ?? "Settings"}
        </h1>
        {meta?.description ? (
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            {meta.description}
          </p>
        ) : null}
      </header>

      {category === "data_sources" ? (
        <DataSourcesPanel />
      ) : category === "integrations" ? (
        <IntegrationsPanel />
      ) : category === "advanced" ? (
        <AdvancedPanel />
      ) : category === "about" ? (
        <AboutPanel />
      ) : (
        <PreferenceSections category={category} />
      )}
    </div>
  )
}

function PreferenceSections({ category }: { category: SettingsCategoryId }) {
  const preferences = preferencesForCategory(category)
  const sections = groupBySection(preferences)

  return (
    <div className="space-y-12">
      {Object.entries(sections).map(([section, items]) => (
        <section key={section}>
          <h3 className="text-[13px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
            {section}
          </h3>
          <div className="mt-2 divide-y divide-border/25">
            {items.map((preference) => (
              <PreferenceField key={preference.id} preference={preference} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function SearchResults({
  hits,
  query,
  onJumpCategory,
}: {
  hits: SettingsSearchHit[]
  query: string
  onJumpCategory: (id: SettingsCategoryId) => void
}) {
  return (
    <div className="mx-auto w-full max-w-[760px] px-6 py-10 lg:px-12">
      <header className="mb-10">
        <h1 className="text-[32px] font-semibold tracking-tight text-foreground">
          Search
        </h1>
        <p className="mt-3 text-[15px] text-muted-foreground">
          {hits.length} result{hits.length === 1 ? "" : "s"} for “{query}”
        </p>
      </header>

      {hits.length === 0 ? (
        <p className="text-[15px] text-muted-foreground">
          No settings match that query.
        </p>
      ) : (
        <ul className="divide-y divide-border/25">
          {hits.map((hit) => (
            <li key={hit.preference.id} className="py-5">
              <button
                type="button"
                onClick={() => onJumpCategory(hit.preference.category)}
                className="mb-3 text-left text-[12px] tracking-[0.12em] text-muted-foreground/70 uppercase transition-colors hover:text-foreground"
              >
                {hit.categoryLabel} · {hit.preference.section}
              </button>
              <PreferenceField preference={hit.preference} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function groupBySection(
  items: PreferenceDefinition[]
): Record<string, PreferenceDefinition[]> {
  const map: Record<string, PreferenceDefinition[]> = {}
  for (const item of items) {
    const list = map[item.section] ?? []
    list.push(item)
    map[item.section] = list
  }
  return map
}
