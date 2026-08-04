"use client"

import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { SectionLabel } from "@/components/ui/section-label"
import {
  SETTINGS_CATEGORIES,
  type SettingsCategoryId,
} from "@/lib/settings"
import { cn } from "@/lib/utils"

export function SettingsNav({
  active,
  onSelect,
  search,
  onSearchChange,
}: {
  active: SettingsCategoryId
  onSelect: (id: SettingsCategoryId) => void
  search: string
  onSearchChange: (value: string) => void
}) {
  return (
    <aside className="flex h-full w-full flex-col border-r border-border/30">
      <div className="space-y-4 px-5 pt-8 pb-4">
        <SectionLabel>Settings</SectionLabel>
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search settings"
            className="h-9 border-border/40 bg-card/20 pl-9 text-[13px]"
          />
        </label>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-8">
        <ul className="space-y-0.5">
          {SETTINGS_CATEGORIES.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => onSelect(category.id)}
                className={cn(
                  "w-full rounded-lg px-3 py-2.5 text-left text-[14px] transition-colors",
                  active === category.id && !search
                    ? "bg-card/60 font-medium text-foreground"
                    : "text-muted-foreground hover:bg-card/30 hover:text-foreground"
                )}
              >
                {category.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
