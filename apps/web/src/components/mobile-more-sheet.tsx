"use client";

import { useEffect, useCallback } from "react";
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
  LayoutDashboard,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@obscura/ui/lib/utils";

const sections = [
  {
    kicker: "Overview",
    items: [
      { label: "Dashboard", href: "/", Icon: LayoutDashboard },
      { label: "Search", href: "/search", Icon: Search },
    ],
  },
  {
    kicker: "Browse",
    items: [
      { label: "Scenes", href: "/scenes", Icon: Film },
      { label: "Galleries", href: "/galleries", Icon: Images },
      { label: "Images", href: "/images", Icon: Image },
      { label: "Performers", href: "/performers", Icon: Users },
      { label: "Studios", href: "/studios", Icon: Building2 },
      { label: "Tags", href: "/tags", Icon: Tags },
      { label: "Collections", href: "/collections", Icon: FolderOpen },
    ],
  },
  {
    kicker: "Operate",
    items: [
      { label: "Scrape", href: "/scrape", Icon: ScanSearch },
      { label: "Jobs", href: "/jobs", Icon: Activity },
      { label: "Settings", href: "/settings", Icon: Settings },
    ],
  },
];

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

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet — anchored above the mobile nav bar */}
      <div
        role="dialog"
        aria-label="Navigation"
        className="fixed inset-x-0 bottom-14 z-[60] rounded-t-2xl border-t border-border-subtle bg-surface-1"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <span className="h-1 w-8 rounded-full bg-border-subtle" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-4 pb-3">
          <span className="text-sm font-medium text-text-primary">
            Navigate
          </span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation sections */}
        <nav className="max-h-[60dvh] overflow-y-auto p-3">
          {sections.map((section) => (
            <div key={section.kicker} className="mb-4 last:mb-0">
              <div className="px-2 pb-1.5 text-[0.65rem] font-semibold uppercase tracking-widest text-text-accent">
                {section.kicker}
              </div>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href + "/"));

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-md px-2.5 py-2.5 text-sm transition-colors",
                          isActive
                            ? "bg-accent-950 text-glow-accent"
                            : "text-text-muted active:bg-surface-2",
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent-500 shadow-[var(--shadow-glow-accent)]" />
                        )}
                        <item.Icon
                          className={cn(
                            "h-4 w-4 flex-shrink-0",
                            isActive
                              ? "text-accent-300 drop-shadow-[0_0_8px_rgba(199,155,92,0.5)]"
                              : "text-text-muted group-hover:text-text-primary",
                          )}
                        />
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
