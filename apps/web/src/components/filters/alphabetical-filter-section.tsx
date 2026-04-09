"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";

export interface AlphabeticalFilterSectionItem {
  id: string;
  name: string;
  count: number;
}

interface AlphabeticalFilterSectionProps {
  title: string;
  icon?: LucideIcon;
  items: AlphabeticalFilterSectionItem[];
  searchPlaceholder: string;
  emptyIcon?: LucideIcon;
  emptyLabel?: string;
  chipVariant?: "info" | "accent";
  groupingThreshold?: number;
  searchThreshold?: number;
  isActive: (item: AlphabeticalFilterSectionItem) => boolean;
  onToggle: (item: AlphabeticalFilterSectionItem) => void;
}

export function AlphabeticalFilterSection({
  title,
  icon: Icon,
  items,
  searchPlaceholder,
  emptyIcon: EmptyIcon,
  emptyLabel,
  chipVariant = "info",
  groupingThreshold = 24,
  searchThreshold = 12,
  isActive,
  onToggle,
}: AlphabeticalFilterSectionProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, search]);

  const grouped = useMemo(() => {
    if (filtered.length <= groupingThreshold) return null;
    const groups: Record<string, AlphabeticalFilterSectionItem[]> = {};
    for (const item of filtered) {
      const letter = item.name[0]?.toUpperCase() || "#";
      (groups[letter] ??= []).push(item);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, groupingThreshold]);

  const showSearch = items.length > searchThreshold;

  const activeClass = chipVariant === "accent" ? "tag-chip-accent" : "tag-chip-info";
  const hoverClass =
    chipVariant === "accent" ? "tag-chip-default hover:tag-chip-accent" : "tag-chip-default hover:tag-chip-info";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-kicker">
          {Icon && <Icon className="h-3 w-3 text-text-disabled" />}
          {title}
        </div>
        <span className="text-[0.6rem] font-mono text-text-disabled tabular-nums">
          {filtered.length !== items.length
            ? `${filtered.length} / ${items.length}`
            : items.length}
        </span>
      </div>

      {showSearch && (
        <div className="relative mb-2">
          <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-text-disabled pointer-events-none" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full bg-surface-1 border border-border-subtle",
              "pl-6 pr-2 py-1 text-[0.7rem] text-text-primary",
              "placeholder:text-text-disabled",
              "focus:outline-none focus:border-border-accent",
              "transition-colors duration-fast",
            )}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-muted"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      <div className="max-h-48 overflow-y-auto tag-scroll-area">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-4 text-[0.68rem] text-text-disabled">
            {EmptyIcon && <EmptyIcon className="h-3 w-3 mr-1.5 opacity-50" />}
            {search
              ? `No matching ${emptyLabel ?? "items"}`
              : `No ${emptyLabel ?? "items"} available`}
          </div>
        ) : grouped ? (
          <div className="space-y-2">
            {grouped.map(([letter, letterItems]) => (
              <div key={letter}>
                <div className="sticky top-0 z-10 text-[0.55rem] font-mono font-semibold text-text-disabled uppercase tracking-widest px-0.5 py-0.5 bg-surface-2/90 backdrop-blur-sm border-b border-border-subtle mb-1">
                  {letter}
                </div>
                <div className="flex flex-wrap gap-1">
                  {letterItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onToggle(item)}
                      className={cn(
                        "tag-chip cursor-pointer transition-colors duration-fast",
                        isActive(item) ? activeClass : hoverClass,
                      )}
                    >
                      {item.name}
                      <span className="text-text-disabled ml-1">{item.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item)}
                className={cn(
                  "tag-chip cursor-pointer transition-colors duration-fast",
                  isActive(item) ? activeClass : hoverClass,
                )}
              >
                {item.name}
                <span className="text-text-disabled ml-1">{item.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
