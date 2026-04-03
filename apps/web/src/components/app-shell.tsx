"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { CanvasHeader } from "./canvas-header";
import { MobileNav } from "./mobile-nav";
import { cn } from "@obscura/ui";

function getSidebarState(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("obscura-sidebar=collapsed");
}

function setSidebarCookie(collapsed: boolean) {
  document.cookie = `obscura-sidebar=${collapsed ? "collapsed" : "expanded"};path=/;max-age=${60 * 60 * 24 * 365}`;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(getSidebarState());
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    setSidebarCookie(next);
  };

  return (
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
          collapsed ? "md:ml-14" : "md:ml-60"
        )}
        style={{ transitionTimingFunction: "var(--ease-mechanical)" }}
      >
        <CanvasHeader />
        <div className="flex-1 p-5">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  );
}
