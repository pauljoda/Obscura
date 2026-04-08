"use client";

import { Eye, EyeOff, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@obscura/ui/lib/utils";
import { useNsfw } from "./nsfw/nsfw-context";
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
  const { mode: nsfwMode, toggleShowOffMode } = useNsfw();
  const [appleMod, setAppleMod] = useState(false);
  useEffect(() => {
    setAppleMod(typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.userAgent));
  }, []);
  const nsfwShortcutKbd = appleMod ? "⌘⇧U" : "Ctrl+Shift+U";
  const nsfwFullOn = nsfwMode === "show";
  const nsfwHeaderLabel = nsfwMode === "show" ? "NSFW" : nsfwMode === "off" ? "SFW" : "Blur";

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
          onClick={toggleShowOffMode}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5",
            "surface-well text-mono-sm",
            "hover:text-text-primary hover:border-border-accent",
            "transition-colors duration-fast cursor-pointer select-none",
            nsfwFullOn
              ? "text-text-primary border-border-accent"
              : nsfwMode === "blur"
                ? "text-text-muted border-border-subtle"
                : "text-text-muted",
          )}
          aria-label={
            nsfwMode === "show"
              ? "Switch to SFW mode (hide adult content)"
              : "Switch to full NSFW mode (show all content)"
          }
          aria-pressed={nsfwFullOn}
          title={`Toggle SFW and full NSFW (${nsfwShortcutKbd}). Skips blur; set blur only in Settings.`}
        >
          {nsfwMode === "off" ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline text-text-disabled">{nsfwHeaderLabel}</span>
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border-subtle px-1.5 text-[0.6rem] text-text-disabled">
            {nsfwShortcutKbd}
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
