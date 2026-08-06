"use client"

import { useState } from "react"

import { SettingsNav } from "@/components/settings/settings-nav"
import { SettingsPanel } from "@/components/settings/settings-panel"
import { SETTINGS_CATEGORIES } from "@/lib/settings"
import {
  useActiveSettingsCategory,
  useSettingsBootstrap,
  useSettingsSearch,
} from "@/lib/settings"

export function SettingsWorkspace() {
  useSettingsBootstrap()
  const { category, setCategory } = useActiveSettingsCategory()
  const [search, setSearch] = useState("")
  const hits = useSettingsSearch(search)

  return (
    <div className="flex h-[calc(100svh-2.75rem)] w-full overflow-hidden">
      <div className="hidden h-full w-[280px] shrink-0 overflow-hidden md:block">
        <SettingsNav
          active={category}
          onSelect={(id) => {
            setSearch("")
            setCategory(id)
          }}
          search={search}
          onSearchChange={setSearch}
        />
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="border-b border-border/30 px-6 py-4 md:hidden">
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as typeof category)
            }
            className="h-10 w-full rounded-xl border border-border/40 bg-card/30 px-3 text-[14px] text-foreground"
          >
            {SETTINGS_CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search settings"
            className="mt-3 h-10 w-full rounded-xl border border-border/40 bg-card/30 px-3 text-[14px] text-foreground outline-none"
          />
        </div>

        <SettingsPanel
          category={category}
          searchHits={hits}
          searchQuery={search}
          onJumpCategory={(id) => {
            setSearch("")
            setCategory(id)
          }}
        />
      </div>
    </div>
  )
}
