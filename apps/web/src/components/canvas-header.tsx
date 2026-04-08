"use client";

import { Search, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@obscura/ui/lib/utils";
import { useSearchPalette } from "./search/search-context";
import { entityTerms } from "../lib/terminology";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Map route segments to user-facing labels (paths stay /scenes, /performers). */
const SEGMENT_LABELS: Record<string, string> = {
  scenes: entityTerms.scenes,
  performers: entityTerms.performers,
};

function segmentLabel(seg: string): string {
  const decoded = decodeURIComponent(seg);
  const mapped = SEGMENT_LABELS[decoded.toLowerCase()];
  if (mapped) return mapped;
  return decoded.charAt(0).toUpperCase() + decoded.slice(1);
}

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  // Skip UUID segments — the detail page already shows the title
  return segments
    .filter((seg) => !UUID_RE.test(seg))
    .map((seg, i, arr) => ({
      label: segmentLabel(seg),
      href: "/" + segments.slice(0, segments.indexOf(seg) + 1).join("/"),
      isLast: i === arr.length - 1,
    }));
}

export function CanvasHeader() {
  const pathname = usePathname();
  const crumbs = getBreadcrumbs(pathname);
  const { openPalette } = useSearchPalette();
  const [appleMod, setAppleMod] = useState(false);
  useEffect(() => {
    setAppleMod(typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.userAgent));
  }, []);
  const searchShortcutKbd = appleMod ? "⌘K" : "Ctrl+K";

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
          type="button"
          onClick={openPalette}
          className={cn(
            "group flex items-center justify-center sm:justify-between w-8 sm:w-64 px-0 sm:px-3 py-1.5",
            "bg-transparent sm:bg-surface-1 border border-transparent sm:border-border-default sm:border-t-[rgba(0,0,0,0.6)]",
            "sm:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]",
            "text-text-muted hover:text-text-primary sm:hover:border-border-accent focus-visible:border-border-accent-strong focus-visible:shadow-focus-accent",
            "transition-all duration-fast cursor-text select-none outline-none",
          )}
          aria-label="Open search"
          title={`Search (${searchShortcutKbd})`}
        >
          <div className="flex items-center gap-2.5">
            <Search className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-text-muted sm:text-text-disabled group-hover:text-text-primary sm:group-hover:text-text-muted transition-colors duration-fast" />
            <span className="hidden sm:inline text-[0.8rem]">Search...</span>
          </div>
          <kbd className="hidden sm:inline-flex h-5 items-center border border-border-subtle px-1.5 text-[0.65rem] font-mono text-text-disabled bg-surface-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_2px_rgba(0,0,0,0.2)]">
            {searchShortcutKbd}
          </kbd>
        </button>
        <Link
          href="/settings"
          className="flex h-8 w-8 items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors duration-fast"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}
