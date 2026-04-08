"use client";

import { useState } from "react";
import {
  Film,
  Image,
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
  Search,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { appShellSections } from "@obscura/ui/navigation/app-shell-sections";
import { cn } from "@obscura/ui/lib/utils";
import { Logo, LogoMark } from "./logo";
import { ChangelogDialog } from "./changelog-dialog";
import { APP_VERSION } from "../lib/version";
import { useNsfw } from "./nsfw/nsfw-context";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "layout-dashboard": LayoutDashboard,
  film: Film,
  images: Images,
  image: Image,
  users: Users,
  building: Building2,
  tags: Tags,
  folder: FolderOpen,
  "scan-search": ScanSearch,
  activity: Activity,
  settings: Settings,
  search: Search,
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface SidebarNavItemProps {
  href: string;
  label: string;
  icon: string;
  pathname: string;
  isExpanded: boolean;
}

function SidebarNavItem({ href, label, icon, pathname, isExpanded }: SidebarNavItemProps) {
  const Icon = iconMap[icon];
  const displayLabel = label;
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  return (
    <li>
      <Link
        href={href}
        className={cn(
          "group relative flex items-center px-2.5 py-2 text-sm transition-colors duration-fast whitespace-nowrap",
          isActive
            ? "bg-accent-950 text-glow-accent"
            : "text-text-muted hover:text-text-primary hover:bg-surface-2"
        )}
        title={!isExpanded ? displayLabel : undefined}
      >
        {isActive && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-accent-500 shadow-[var(--shadow-glow-accent)]" />
        )}
        <div className="w-5 flex items-center justify-center shrink-0">
          {Icon && (
            <Icon
              className={cn(
                "h-4 w-4",
                isActive
                  ? "text-accent-300 drop-shadow-[0_0_8px_rgba(199,155,92,0.5)]"
                  : "text-text-muted group-hover:text-text-primary"
              )}
            />
          )}
        </div>
        <div
          className={cn(
            "overflow-hidden transition-[max-width,opacity] duration-moderate",
            isExpanded ? "max-w-[160px] opacity-100 ml-3" : "max-w-0 opacity-0 ml-0"
          )}
        >
          {displayLabel}
        </div>
      </Link>
    </li>
  );
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  const { mode } = useNsfw();

  const isExpanded = !collapsed || hovered;

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "fixed left-0 top-0 z-40 flex h-dvh flex-col bg-surface-1 border-r border-border-subtle transition-[width] duration-moderate overflow-hidden",
        isExpanded ? "w-60" : "w-14"
      )}
      style={{
        transitionTimingFunction: "var(--ease-mechanical)",
      }}
    >
      {/* Logo + collapse toggle */}
      <div className="flex h-14 items-center justify-between px-3 border-b border-border-subtle shrink-0">
        <Link href="/" aria-label="Dashboard" className="shrink-0 flex items-center h-full">
          <div className="w-8 flex items-center justify-center shrink-0">
            <LogoMark size={24} />
          </div>
          <div
            className={cn(
              "overflow-hidden transition-[max-width,opacity] duration-moderate flex items-center",
              isExpanded ? "max-w-[160px] opacity-100 ml-2" : "max-w-0 opacity-0 ml-0"
            )}
          >
            <span className="font-heading font-bold tracking-[0.18em] text-text-primary text-lg">OBSCURA</span>
          </div>
        </Link>
        <div
          className={cn(
            "shrink-0 overflow-hidden transition-[max-width,opacity] duration-moderate flex items-center justify-end",
            isExpanded ? "max-w-[32px] opacity-100" : "max-w-0 opacity-0"
          )}
        >
          <button
            onClick={onToggle}
            className="flex h-8 w-8 items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors duration-fast"
            aria-label={collapsed ? "Pin sidebar open" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation sections */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 scrollbar-hidden">
        {appShellSections.map((section) => (
          <div key={section.id} className="mb-4">
            <div
              className={cn(
                "px-4 pb-1.5 text-kicker whitespace-nowrap transition-[max-height,opacity] duration-moderate overflow-hidden",
                isExpanded ? "max-h-8 opacity-100" : "max-h-0 opacity-0"
              )}
            >
              {section.kicker}
            </div>
            
            <div
              className={cn(
                "mx-auto mb-1 w-6 separator transition-[max-height,opacity] duration-moderate overflow-hidden",
                !isExpanded ? "max-h-2 opacity-100" : "max-h-0 opacity-0"
              )}
            />
            <ul className="space-y-0.5 px-2">
              {section.items
                .filter((item) => {
                  // Hide Identify in SFW mode
                  if (item.href === "/identify" && mode === "off") return false;
                  return true;
                })
                .map((item) => (
                  <SidebarNavItem
                    key={item.href}
                    href={item.href as string}
                    label={item.label}
                    icon={item.icon}
                    pathname={pathname}
                    isExpanded={isExpanded}
                  />
                ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom version indicator */}
      <div className="border-t border-border-subtle px-3 py-3 shrink-0">
        <ChangelogDialog version={APP_VERSION}>
          <div className="flex items-center group overflow-hidden whitespace-nowrap h-5">
            <div className="w-8 flex items-center justify-center shrink-0">
              <span className="led led-sm led-idle" />
            </div>
            <div
              className={cn(
                "overflow-hidden transition-[max-width,opacity] duration-moderate",
                isExpanded ? "max-w-[160px] opacity-100 ml-1" : "max-w-0 opacity-0 ml-0"
              )}
            >
              <span className="text-mono-sm text-text-disabled transition-colors group-hover:text-text-accent">
                v{APP_VERSION}
              </span>
            </div>
          </div>
        </ChangelogDialog>
      </div>
    </aside>
  );
}
