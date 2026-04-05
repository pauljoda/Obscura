"use client";

import {
  Film,
  Images,
  Users,
  Building2,
  Tags,
  FolderOpen,
  ScanSearch,
  Activity,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@obscura/ui";
import { appShellSections } from "@obscura/ui";
import { Logo, LogoMark } from "./logo";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "layout-dashboard": LayoutDashboard,
  film: Film,
  images: Images,
  users: Users,
  building: Building2,
  tags: Tags,
  folder: FolderOpen,
  "scan-search": ScanSearch,
  activity: Activity,
  settings: Settings,
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-dvh flex-col bg-surface-1 border-r border-border-subtle transition-[width] duration-moderate",
        collapsed ? "w-14" : "w-60"
      )}
      style={{
        transitionTimingFunction: "var(--ease-mechanical)",
      }}
    >
      {/* Logo + collapse toggle */}
      <div className="flex h-14 items-center justify-between px-3 border-b border-border-subtle">
        <Link href="/" aria-label="Dashboard">
          {collapsed ? (
            <LogoMark size={24} />
          ) : (
            <Logo size={24} />
          )}
        </Link>
        <button
          onClick={onToggle}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors duration-fast"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation sections */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 scrollbar-hidden">
        {appShellSections.map((section) => (
          <div key={section.id} className="mb-4">
            {!collapsed && (
              <div className="px-4 pb-1.5 text-kicker">{section.kicker}</div>
            )}
            {collapsed && <div className="mx-auto mb-1 w-6 separator" />}
            <ul className="space-y-0.5 px-2">
              {section.items.map((item) => {
                const Icon = iconMap[item.icon];
                const href = item.href as string;
                const isActive =
                  pathname === href ||
                  (href !== "/" && pathname.startsWith(href + "/"));

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors duration-fast",
                        isActive
                          ? "bg-accent-950 text-glow-accent"
                          : "text-text-muted hover:text-text-primary hover:bg-surface-2"
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent-500 shadow-[var(--shadow-glow-accent)]" />
                      )}
                      {Icon && (
                        <Icon
                          className={cn(
                            "h-4 w-4 flex-shrink-0",
                            isActive
                              ? "text-accent-300 drop-shadow-[0_0_8px_rgba(199,155,92,0.5)]"
                              : "text-text-muted group-hover:text-text-primary"
                          )}
                        />
                      )}
                      {!collapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom status cluster */}
      <div className="border-t border-border-subtle px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="led led-sm led-idle" />
          {!collapsed && (
            <span className="text-mono-sm text-text-disabled">
              Workers idle
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
