"use client"

import { AboutPanel } from "@/components/settings/about-panel"
import { AdvancedPanel } from "@/components/settings/advanced-panel"
import { AppearanceSettingsPanel } from "@/components/settings/appearance-settings-panel"
import { CloudPanel } from "@/components/settings/cloud-panel"
import { HealthSourcesPanel } from "@/components/settings/health-sources-panel"
import { NotificationsSettingsPanel } from "@/components/settings/notifications-settings-panel"
import { PreferenceField } from "@/components/settings/preference-field"
import { PreferencesSettingsPanel } from "@/components/settings/preferences-settings-panel"
import { PrivacySettingsPanel } from "@/components/settings/privacy-settings-panel"
import { ProfileSettingsPanel } from "@/components/settings/profile-settings-panel"
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

      {category === "profile" ? (
        <ProfileSettingsPanel />
      ) : category === "appearance" ? (
        <AppearanceSettingsPanel />
      ) : category === "preferences" || category === "general" ? (
        <PreferencesSettingsPanel />
      ) : category === "health_sources" ||
        category === "data_sources" ||
        category === "integrations" ? (
        <HealthSourcesPanel />
      ) : category === "cloud" ? (
        <CloudPanel />
      ) : category === "notifications" ? (
        <NotificationsSettingsPanel />
      ) : category === "privacy" ? (
        <PrivacySettingsPanel />
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
  if (!hits.length) {
    return (
      <div className="mx-auto max-w-[760px] px-6 py-10">
        <p className="text-[15px] text-muted-foreground">
          No settings match “{query}”.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[760px] space-y-4 px-6 py-10">
      <p className="text-[14px] text-muted-foreground">
        {hits.length} result{hits.length === 1 ? "" : "s"} for “{query}”
      </p>
      <div className="divide-y divide-border/25">
        {hits.map(({ preference }) => (
          <button
            key={preference.id}
            type="button"
            onClick={() => onJumpCategory(preference.category)}
            className="flex w-full flex-col items-start gap-1 py-4 text-left"
          >
            <span className="text-[15px] text-foreground">{preference.label}</span>
            <span className="text-[13px] text-muted-foreground">
              {preference.category.replaceAll("_", " ")}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function groupBySection(preferences: PreferenceDefinition[]) {
  return preferences.reduce<Record<string, PreferenceDefinition[]>>(
    (acc, preference) => {
      const key = preference.section
      acc[key] = acc[key] ?? []
      acc[key].push(preference)
      return acc
    },
    {}
  )
}
