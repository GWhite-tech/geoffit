"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

const pages = [
  { label: "Home", href: "/" },
] as const;

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-black/50"
        onClick={() => setOpen(false)}
      />
      <div className="relative mx-auto mt-[15vh] w-full max-w-lg px-4">
        <Command
          className={cn(
            "overflow-hidden rounded-xl border border-black/10 bg-background text-foreground shadow-2xl",
            "dark:border-white/10",
          )}
          label="Command palette"
        >
          <div className="flex items-center gap-2 border-b border-black/10 px-3 dark:border-white/10">
            <Search className="size-4 shrink-0 opacity-50" aria-hidden />
            <Command.Input
              placeholder="Search pages..."
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-foreground/50"
            />
          </div>
          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="px-2 py-6 text-center text-sm text-foreground/60">
              No results found.
            </Command.Empty>
            <Command.Group heading="Pages" className="text-xs text-foreground/50">
              {pages.map((page) => (
                <Command.Item
                  key={page.href}
                  value={page.label}
                  onSelect={() => {
                    setOpen(false);
                    router.push(page.href);
                  }}
                  className="flex cursor-pointer items-center rounded-md px-2 py-2 text-sm text-foreground aria-selected:bg-foreground/5"
                >
                  {page.label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
