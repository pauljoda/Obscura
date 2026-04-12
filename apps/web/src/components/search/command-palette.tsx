"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Clock,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { SearchResultItem, SearchResultGroup } from "@obscura/contracts";
import { useSearchPalette } from "./search-context";
import { entityTerms } from "../../lib/terminology";
import { useSearch } from "../../hooks/use-search";
import { useRecentSearches } from "../../hooks/use-recent-searches";
import { SEARCH_KIND_CONFIG } from "./search-kind-config";
import { SearchResultCard } from "./search-result-card";
import { useNsfw } from "../nsfw/nsfw-context";

export function CommandPalette() {
  const { open, closePalette } = useSearchPalette();
  const { mode: nsfwMode } = useNsfw();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const recentSearches = useRecentSearches();
  const { data, loading } = useSearch(query, { debounceMs: 250, nsfw: nsfwMode });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Focus input when opened, clear when closed
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery("");
    }
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  const handleNavigate = useCallback(
    (href: string) => {
      if (query.trim()) recentSearches.add(query.trim());
      closePalette();
      router.push(href);
    },
    [query, recentSearches, closePalette, router]
  );

  const handleSubmit = useCallback(() => {
    if (query.trim()) {
      recentSearches.add(query.trim());
      closePalette();
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }, [query, recentSearches, closePalette, router]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  if (!mounted || !open) return null;

  const hasQuery = query.trim().length >= 2;
  const hasResults = data && data.groups.some((g) => g.items.length > 0);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] sm:pt-[10vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closePalette}
      />

      {/* Panel */}
      <div
        className={cn(
          "relative w-full max-w-2xl mx-4",
          "surface-elevated shadow-2xl",
          "border border-border-subtle",
          "flex flex-col max-h-[70vh]"
        )}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
          <Search className="h-4 w-4 text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Search ${entityTerms.scenes.toLowerCase()}, ${entityTerms.performers.toLowerCase()}, ${entityTerms.studios.toLowerCase()}, ${entityTerms.tags.toLowerCase()}...`}
            className={cn(
              "flex-1 bg-transparent text-sm text-text-primary",
              "placeholder:text-text-disabled",
              "focus:outline-none"
            )}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-text-disabled hover:text-text-muted transition-colors duration-fast"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border-subtle px-1.5 text-[0.6rem] text-text-disabled shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results body */}
        <div className="overflow-y-auto flex-1">
          {!hasQuery && (
            <RecentSearchesList
              searches={recentSearches.searches}
              onSelect={(q) => { setQuery(q); }}
              onRemove={recentSearches.remove}
              onClear={recentSearches.clear}
            />
          )}

          {hasQuery && loading && !data && (
            <div className="px-4 py-8 text-center">
              <div className="text-text-disabled text-sm">Searching...</div>
            </div>
          )}

          {hasQuery && data && !hasResults && !loading && (
            <div className="px-4 py-8 text-center">
              <div className="text-text-disabled text-sm">No results for &ldquo;{query}&rdquo;</div>
            </div>
          )}

          {hasQuery && data && hasResults && (
            <div className="py-1">
              {data.groups
                .filter((g) => g.items.length > 0)
                .map((group) => (
                  <ResultGroup
                    key={group.kind}
                    group={group}
                    onNavigate={handleNavigate}
                    query={query}
                  />
                ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {hasQuery && (
          <div className="border-t border-border-subtle px-4 py-2 flex items-center justify-between">
            <button
              onClick={handleSubmit}
              className="flex items-center gap-1.5 text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast"
            >
              <span>See all results</span>
              <ArrowRight className="h-3 w-3" />
            </button>
            <span className="text-[0.6rem] text-text-disabled font-mono">
              {loading ? "..." : `${data?.durationMs ?? 0}ms`}
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function RecentSearchesList({
  searches,
  onSelect,
  onRemove,
  onClear,
}: {
  searches: string[];
  onSelect: (query: string) => void;
  onRemove: (query: string) => void;
  onClear: () => void;
}) {
  if (searches.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <Search className="h-5 w-5 text-text-disabled mx-auto mb-2 opacity-50" />
        <div className="text-text-disabled text-sm">Start typing to search...</div>
      </div>
    );
  }

  return (
    <div className="py-1">
      <div className="flex items-center justify-between px-4 py-1.5">
        <span className="text-kicker">Recent Searches</span>
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-[0.6rem] text-text-disabled hover:text-text-muted transition-colors duration-fast"
        >
          <Trash2 className="h-2.5 w-2.5" />
          Clear
        </button>
      </div>
      {searches.map((q) => (
        <div
          key={q}
          className="flex items-center gap-2 px-4 py-1.5 hover:bg-surface-2 transition-colors duration-fast cursor-pointer group"
        >
          <Clock className="h-3.5 w-3.5 text-text-disabled shrink-0" />
          <button
            onClick={() => onSelect(q)}
            className="flex-1 text-left text-sm text-text-muted group-hover:text-text-primary truncate"
          >
            {q}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(q); }}
            className="opacity-0 group-hover:opacity-100 text-text-disabled hover:text-text-muted transition-all duration-fast"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

function ResultGroup({
  group,
  onNavigate,
  query,
}: {
  group: SearchResultGroup;
  onNavigate: (href: string) => void;
  query: string;
}) {
  const { icon: Icon, label } = SEARCH_KIND_CONFIG[group.kind];

  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-1.5">
        <Icon className="h-3 w-3 text-text-disabled" />
        <span className="text-kicker">{label}</span>
        <span className="text-[0.55rem] font-mono text-text-disabled">{group.total}</span>
      </div>
      {group.items.map((item) => (
        <ResultRow key={item.id} item={item} onNavigate={onNavigate} />
      ))}
      {group.hasMore && (
        <button
          onClick={() =>
            onNavigate(`/search?q=${encodeURIComponent(query)}&kinds=${group.kind}`)
          }
          className="flex items-center gap-1.5 px-4 py-1 text-[0.68rem] text-text-muted hover:text-text-accent transition-colors duration-fast w-full"
        >
          <ArrowRight className="h-2.5 w-2.5" />
        <span>View all {group.total} {label.toLowerCase()}</span>
        </button>
      )}
    </div>
  );
}

function ResultRow({
  item,
  onNavigate,
}: {
  item: SearchResultItem;
  onNavigate: (href: string) => void;
}) {
  return <SearchResultCard item={item} variant="compact" onSelect={onNavigate} />;
}
