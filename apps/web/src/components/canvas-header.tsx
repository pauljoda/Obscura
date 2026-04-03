"use client";

import { Search, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@obscura/ui";

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1),
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));
}

export function CanvasHeader() {
  const pathname = usePathname();
  const crumbs = getBreadcrumbs(pathname);

  return (
    <header className="flex h-14 items-center justify-between border-b border-border-subtle px-5">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-mono-sm" aria-label="Breadcrumb">
        {crumbs.length === 0 ? (
          <span className="text-text-muted">Dashboard</span>
        ) : (
          crumbs.map((crumb) => (
            <span key={crumb.href} className="flex items-center gap-1.5">
              {crumb !== crumbs[0] && (
                <span className="text-text-disabled">/</span>
              )}
              {crumb.isLast ? (
                <span className="text-text-primary">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-text-muted hover:text-text-primary transition-colors duration-fast"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          ))
        )}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-1.5",
            "surface-well text-text-muted text-mono-sm",
            "hover:text-text-secondary transition-colors duration-fast"
          )}
          aria-label="Open command palette"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border-subtle px-1.5 text-[0.6rem] text-text-disabled">
            ⌘K
          </kbd>
        </button>
        <Link
          href="/settings"
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors duration-fast"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}
