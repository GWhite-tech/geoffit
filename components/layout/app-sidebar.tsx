"use client"

import Link from "next/link"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { navSections, type NavItem } from "@/lib/dashboard-data"
import { cn } from "@/lib/utils"

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <SidebarMenuItem className="relative">
      {item.active ? (
        <span className="absolute top-1/2 left-0 size-1 -translate-y-1/2 rounded-full bg-primary" />
      ) : null}
      <SidebarMenuButton
        render={<Link href={item.href} />}
        isActive={item.active}
        className={cn(
          "h-12 rounded-lg pl-4 text-[13px] transition-colors",
          "hover:bg-primary/[0.04] data-active:bg-primary/[0.04]",
          item.active
            ? "font-medium text-primary hover:text-primary"
            : "font-normal text-muted-foreground/65 hover:text-foreground/75"
        )}
      >
        <item.icon
          className={cn(
            "size-4",
            item.active ? "text-primary" : "text-muted-foreground/55"
          )}
        />
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="none" className="bg-background">
      <SidebarHeader className="px-5 py-10">
        <Link
          href="/"
          className="px-2 text-sm font-semibold tracking-tight text-foreground"
        >
          Geoffit
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 pb-10">
        {navSections.map((section) => (
          <div key={section.label} className="mb-9 last:mb-0">
            <p className="mb-4 px-3 text-[11px] font-medium tracking-[0.16em] text-muted-foreground/45 uppercase">
              {section.label}
            </p>
            <SidebarMenu className="gap-1.5">
              {section.items.map((item) => (
                <NavItemLink key={item.label} item={item} />
              ))}
            </SidebarMenu>
          </div>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
