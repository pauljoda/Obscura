"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  X,
  ChevronDown,
  Loader2,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { EntityKind, SearchResultItem } from "@obscura/contracts";
import { useSearch } from "../../hooks/use-search";
import { fetchSearch } from "../../lib/api";
import { SEARCH_KIND_CONFIG, ALL_SEARCH_KINDS } from "../search/search-kind-config";
import { SearchResultCard } from "../search/search-result-card";
import { useNsfw } from "../nsfw/nsfw-context";
import { useTerms } from "../../lib/terminology";
import { useCurrentPath } from "../../hooks/use-current-path";

const PAGE_SIZE = 20;

interface SearchPageClientProps {
  initialQuery: string;
  initialKinds: string;
}

export function SearchPageClient({ initialQuery, initialKinds }: SearchPageClientProps) {
  const router = useRouter();
  const { mode: nsfwMode } = useNsfw();
  const terms = useTerms();
  const currentPath = useCurrentPath();

  const [query, setQuery] = useState(initialQuery);
  const [activeKinds, setActiveKinds] = useState<Set<EntityKind>>(() => {
    if (initialKinds) {
      return new Set(
        initialKinds
          .split(",")
          .filter((kind): kind is EntityKind => ALL_SEARCH_KINDS.includes(kind as EntityKind)),
      );
    }
    return new Set(ALL_SEARCH_KINDS);
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Expanded sections with "show more" loaded data
  const [expandedData, setExpandedData] = useState<Record<string, {
    items: SearchResultItem[];
    total: number;
    loading: boolean;
  }>>({});

  const inputRef = useRef<HTMLInputElement>(null);

  const kindsArray = useMemo(() => Array.from(activeKinds), [activeKinds]);

  const { data, loading } = useSearch(query, {
    debounceMs: 300,
    kinds: kindsArray.length < ALL_SEARCH_KINDS.length ? kindsArray : undefined,
    limit: 6,
    rating: minRating ?? undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    nsfw: nsfwMode,
  });

  // Sync query to URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (activeKinds.size < ALL_SEARCH_KINDS.length) {
        params.set("kinds", Array.from(activeKinds).join(","));
      }
      const qs = params.toString();
      router.replace(`/search${qs ? `?${qs}` : ""}`, { scroll: false });
    }, 500);
    return () => clearTimeout(timer);
  }, [query, activeKinds, router]);

  // Reset expanded data when query changes
  useEffect(() => {
    setExpandedData({});
  }, [query, minRating, dateFrom, dateTo]);

  const kindLabel = (kind: string, baseLabel: string) => {
    if (kind === "scene") return terms.scenes;
    if (kind === "performer") return terms.performers;
    return baseLabel;
  };

  const toggleKind = useCallback((kind: EntityKind) => {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) {
        if (next.size > 1) next.delete(kind);
      } else {
        next.add(kind);
      }
      return next;
    });
  }, []);

  const handleLoadMore = useCallback(
    async (kind: EntityKind, currentCount: number, total: number) => {
      const key = kind;
      setExpandedData((prev) => ({
        ...prev,
        [key]: { items: prev[key]?.items ?? [], total, loading: true },
      }));

      try {
        const result = await fetchSearch({
          q: query,
          kind,
          limit: PAGE_SIZE,
          offset: currentCount,
          rating: minRating ?? undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          nsfw: nsfwMode,
        });

        const group = result.groups[0];
        if (group) {
          setExpandedData((prev) => ({
            ...prev,
            [key]: {
              items: [...(prev[key]?.items ?? []), ...group.items],
              total: group.total,
              loading: false,
            },
          }));
        }
      } catch {
        setExpandedData((prev) => ({
          ...prev,
          [key]: { ...prev[key]!, loading: false },
        }));
      }
    },
    [query, minRating, dateFrom, dateTo, nsfwMode]
  );

  const hasQuery = query.trim().length >= 2;
  const hasResults = data && data.groups.some((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {/* Search header */}
      <div className="space-y-3">
        <div className="surface-well flex items-center gap-2 px-3 py-2">
          <Search className="h-4 w-4 text-text-disabled shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search everything..."
            className={cn(
              "flex-1 bg-transparent text-sm text-text-primary",
              "placeholder:text-text-disabled",
              "focus:outline-none"
            )}
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-text-disabled hover:text-text-muted transition-colors duration-fast"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {loading && (
            <Loader2 className="h-3.5 w-3.5 text-text-disabled animate-spin" />
          )}
        </div>

        {/* Entity kind toggles + filter button */}
        <div className="flex items-center gap-2 flex-wrap">
          {ALL_SEARCH_KINDS.map((kind) => {
            const config = SEARCH_KIND_CONFIG[kind];
            const Icon = config.icon;
            const active = activeKinds.has(kind);
            return (
              <button
                key={kind}
                onClick={() => toggleKind(kind)}
                className={cn(
                  "tag-chip cursor-pointer transition-colors duration-fast flex items-center gap-1.5",
                  active ? "tag-chip-accent" : "tag-chip-default"
                )}
              >
                <Icon className="h-3 w-3" />
                {kindLabel(kind, config.label)}
              </button>
            );
          })}

          <div className="h-4 w-px bg-border-subtle" />

          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={cn(
              "tag-chip cursor-pointer transition-colors duration-fast flex items-center gap-1.5",
              filtersOpen ? "tag-chip-info" : "tag-chip-default"
            )}
          >
            <SlidersHorizontal className="h-3 w-3" />
            Filters
            {(minRating || dateFrom || dateTo) && (
              <span className="flex h-3.5 w-3.5 items-center justify-center bg-accent-800 text-[0.5rem] font-bold text-accent-200">
                !
              </span>
            )}
          </button>
        </div>

        {/* Filter panel */}
        {filtersOpen && (
          <div className="surface-well p-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="text-kicker mb-2">Min Rating</div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setMinRating(minRating === n ? null : n)}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center transition-colors duration-fast",
                      minRating && n <= minRating
                        ? "text-text-accent"
                        : "text-text-disabled hover:text-text-muted"
                    )}
                  >
                    <Star className="h-3.5 w-3.5" fill={minRating && n <= minRating ? "currentColor" : "none"} />
                  </button>
                ))}
                {minRating && (
                  <button
                    onClick={() => setMinRating(null)}
                    className="ml-1 text-text-disabled hover:text-text-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <div className="text-kicker mb-2">Date From</div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="control-input text-[0.75rem] w-full"
              />
            </div>
            <div>
              <div className="text-kicker mb-2">Date To</div>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="control-input text-[0.75rem] w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {!hasQuery && (
        <div className="flex flex-col items-center justify-center py-20 text-text-disabled">
          <Search className="h-8 w-8 mb-3 opacity-30" />
          <div className="text-sm">Enter a search term to find scenes, performers, studios, and more</div>
        </div>
      )}

      {hasQuery && loading && !data && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 text-text-disabled animate-spin" />
        </div>
      )}

      {hasQuery && data && !hasResults && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-text-disabled">
          <Search className="h-8 w-8 mb-3 opacity-30" />
          <div className="text-sm">No results for &ldquo;{query}&rdquo;</div>
        </div>
      )}

      {hasQuery && data && hasResults && (
        <div className="space-y-6">
          {data.groups
            .filter((g) => g.items.length > 0 && activeKinds.has(g.kind))
            .map((group) => {
              const expanded = expandedData[group.kind];
              const items = expanded
                ? [...group.items, ...expanded.items]
                : group.items;
              const total = expanded?.total ?? group.total;
              const hasMore = items.length < total;
              const isLoadingMore = expanded?.loading ?? false;

              return (
                <SearchSection
                  key={group.kind}
                  kind={group.kind}
                  label={kindLabel(group.kind, SEARCH_KIND_CONFIG[group.kind].label)}
                  items={items}
                  total={total}
                  hasMore={hasMore}
                  loadingMore={isLoadingMore}
                  onLoadMore={() => handleLoadMore(group.kind, items.length, total)}
                />
              );
            })}
          <div className="text-center text-[0.6rem] font-mono text-text-disabled py-2">
            {data.durationMs}ms
          </div>
        </div>
      )}
    </div>
  );
}

function SearchSection({
  kind,
  label,
  items,
  total,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  kind: EntityKind;
  label: string;
  items: SearchResultItem[];
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const currentPath = useCurrentPath();
  const config = SEARCH_KIND_CONFIG[kind];
  const Icon = config.icon;

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-text-muted" />
          <span className="text-sm font-medium text-text-primary">{label}</span>
          <span className="text-[0.65rem] font-mono text-text-disabled">{total}</span>
        </div>
        <Link
          href={config.href}
          className="text-[0.68rem] text-text-muted hover:text-text-accent transition-colors duration-fast"
        >
          Browse all
        </Link>
      </div>

      {/* Results grid */}
      <div
        className={cn(
          "grid gap-2",
          kind === "scene"
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : kind === "gallery"
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : kind === "image"
            ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5"
            : kind === "performer"
            ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5"
            : kind === "studio"
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            : kind === "tag"
            ? "columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-0 block"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        )}
      >
        {items.map((item) => (
          <SearchResultCard key={item.id} item={item} from={currentPath} />
        ))}
      </div>

      {/* Show more */}
      {hasMore && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 ",
              "text-[0.72rem] text-text-muted",
              "surface-well hover:text-text-primary",
              "transition-colors duration-fast",
              loadingMore && "opacity-60 cursor-wait"
            )}
          >
            {loadingMore ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            Show more ({total - items.length} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
