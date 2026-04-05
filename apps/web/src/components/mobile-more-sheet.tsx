"use client";

import { useEffect, useCallback } from "react";
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
  LayoutDashboard,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { appShellSections } from "@obscura/ui/navigation/app-shell-sections";
import { cn } from "@obscura/ui/lib/utils";

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

interface MobileMoreSheetProps {
  open: boolean;
  onClose: () => void;
}

export function MobileMoreSheet({ open, onClose }: MobileMoreSheetProps) {
  const pathname = usePathname();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-moderate",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-label="Navigation"
        className={cn(
          "fixed bottom-14 left-0 right-0 z-[60] rounded-t-2xl border-t border-border-subtle bg-surface-1 transition-transform duration-moderate",
          open ? "translate-y-0" : "translate-y-full",
        )}
        style={{ transitionTimingFunction: "var(--ease-mechanical)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <span className="text-sm font-medium text-text-primary">
            Navigate
          </span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors duration-fast"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation sections */}
        <nav className="max-h-[60dvh] overflow-y-auto px-3 py-3 scrollbar-hidden">
          {appShellSections.map((section) => (
            <div key={section.id} className="mb-3 last:mb-0">
              <div className="px-2 pb-1.5 text-kicker">{section.kicker}</div>
              <ul className="space-y-0.5">
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
                        onClick={onClose}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-md px-2.5 py-2.5 text-sm transition-colors duration-fast",
                          isActive
                            ? "bg-accent-950 text-glow-accent"
                            : "text-text-muted hover:text-text-primary hover:bg-surface-2",
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent-500 shadow-[var(--shadow-glow-accent)]" />
                        )}
                        {Icon && (
                          <Icon
                            className={cn(
                              "h-4 w-4 flex-shrink-0",
                              isActive
                                ? "text-accent-300 drop-shadow-[0_0_8px_rgba(199,155,92,0.5)]"
                                : "text-text-muted group-hover:text-text-primary",
                            )}
                          />
                        )}
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </>
  );
}
