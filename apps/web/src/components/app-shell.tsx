"use client";

import { useState } from "react";
import { cn } from "@obscura/ui/lib/utils";
import { Sidebar } from "./sidebar";
import { CanvasHeader } from "./canvas-header";
import { MobileNav } from "./mobile-nav";
import { SearchProvider } from "./search/search-context";
import { CommandPalette } from "./search/command-palette";
import { NsfwProvider } from "./nsfw/nsfw-context";
import { AppChromeProvider } from "./app-chrome-context";
import { PlaylistProvider } from "./collections/playlist-context";
import { PlaylistController } from "./collections/playlist-controller";

function setSidebarCookie(collapsed: boolean) {
  document.cookie = `obscura-sidebar=${collapsed ? "collapsed" : "expanded"};path=/;max-age=${60 * 60 * 24 * 365}`;
}

interface AppShellProps {
  children: React.ReactNode;
  initialCollapsed?: boolean;
  lanAutoEnable?: boolean;
  initialNsfwMode?: "off" | "blur" | "show";
}

export function AppShell({ children, initialCollapsed = false, lanAutoEnable = false, initialNsfwMode = "off" }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    setSidebarCookie(next);
  };

  return (
    <NsfwProvider lanAutoEnable={lanAutoEnable} initialMode={initialNsfwMode}>
      <AppChromeProvider sidebarCollapsed={collapsed}>
        <PlaylistProvider>
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
            <PlaylistController />
          </SearchProvider>
        </PlaylistProvider>
      </AppChromeProvider>
    </NsfwProvider>
  );
}
