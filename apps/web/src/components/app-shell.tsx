"use client";

import { useState } from "react";
import { cn } from "@obscura/ui/lib/utils";
import { Sidebar } from "./sidebar";
import { CanvasHeader } from "./canvas-header";
import { MobileNav } from "./mobile-nav";
import { SearchProvider } from "./search/search-context";
import { CommandPalette } from "./search/command-palette";
import { NsfwProvider } from "./nsfw/nsfw-context";

function setSidebarCookie(collapsed: boolean) {
  document.cookie = `obscura-sidebar=${collapsed ? "collapsed" : "expanded"};path=/;max-age=${60 * 60 * 24 * 365}`;
}

interface AppShellProps {
  children: React.ReactNode;
  initialCollapsed?: boolean;
  lanAutoEnable?: boolean;
}

export function AppShell({ children, initialCollapsed = false, lanAutoEnable = false }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    setSidebarCookie(next);
  };

  return (
    <NsfwProvider lanAutoEnable={lanAutoEnable}>
      <SearchProvider>
        <div className="flex min-h-dvh">
          {/* Desktop sidebar */}
          <div className="hidden md:block">
            <Sidebar collapsed={collapsed} onToggle={toggle} />
          </div>

          {/* Main canvas */}
          <main
            className={cn(
              "flex flex-1 flex-col transition-[margin-left] duration-moderate pb-14 md:pb-0",
              "h-dvh overflow-y-auto",
              collapsed ? "md:ml-14" : "md:ml-60",
            )}
            style={{ transitionTimingFunction: "var(--ease-mechanical)" }}
          >
            <CanvasHeader />
            <div className="flex-1 p-5">{children}</div>
          </main>

          {/* Mobile bottom nav */}
          <MobileNav />
        </div>

        <CommandPalette />
      </SearchProvider>
    </NsfwProvider>
  );
}
