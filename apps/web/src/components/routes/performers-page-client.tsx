"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Users,
  Star,
  Search,
  ArrowUpDown,
  ChevronDown,
  Check,
  X,
  SlidersHorizontal,
  Film,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@obscura/ui/lib/utils";
import { fetchPerformers, type PerformerItem } from "../../lib/api";
import { PerformerEntityCard } from "../performers/performer-entity-card";
import { performerItemToCardData } from "../performers/performer-card-data";

type SortKey = "name" | "scenes" | "rating" | "recent";
type SortDir = "asc" | "desc";

const defaultSortDir: Record<SortKey, SortDir> = {
  name: "asc",
  scenes: "desc",
  rating: "desc",
  recent: "desc",
};

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "name", label: "Name A-Z" },
  { value: "scenes", label: "Scene Count" },
  { value: "rating", label: "Rating" },
  { value: "recent", label: "Recently Added" },
];

const genderOptions = [
  { value: "", label: "All Genders" },
  { value: "Female", label: "Female" },
  { value: "Male", label: "Male" },
  { value: "Transgender Female", label: "Trans Female" },
  { value: "Transgender Male", label: "Trans Male" },
  { value: "Non-Binary", label: "Non-Binary" },
];

const PAGE_SIZE = 50;

interface PerformersPageClientProps {
  initialPerformers: PerformerItem[];
  initialTotal: number;
}

export function PerformersPageClient({
  initialPerformers,
  initialTotal,
}: PerformersPageClientProps) {
  const [performers, setPerformers] = useState(initialPerformers);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("scenes");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [gender, setGender] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const deferredSearch = useDeferredValue(search);
  const hydratedRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const hasMore = performers.length < total;

  // Full reload when filters/sort change
  const loadPerformers = useCallback(async () => {
    setLoading(true);

    try {
      const result = await fetchPerformers({
        search: deferredSearch || undefined,
        sort: sortKey,
        order: sortDir,
        gender: gender || undefined,
        favorite: favoriteOnly ? "true" : undefined,
        limit: PAGE_SIZE,
        offset: 0,
      });

      setPerformers(result.performers);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to load performers:", error);
    } finally {
      setLoading(false);
    }
  }, [deferredSearch, favoriteOnly, gender, sortDir, sortKey]);

  // Load more (append) for infinite scroll
  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return;
    setLoadingMore(true);

    try {
      const result = await fetchPerformers({
        search: deferredSearch || undefined,
        sort: sortKey,
        order: sortDir,
        gender: gender || undefined,
        favorite: favoriteOnly ? "true" : undefined,
        limit: PAGE_SIZE,
        offset: performers.length,
      });

      setPerformers((prev) => [...prev, ...result.performers]);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to load more performers:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [deferredSearch, favoriteOnly, gender, loading, loadingMore, performers.length, sortDir, sortKey]);

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }

    const timer = window.setTimeout(loadPerformers, deferredSearch ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [deferredSearch, loadPerformers]);

  // Infinite scroll sentinel
  useEffect(() => {
    if (!hasMore || loadingMore || loading || !sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "400px" },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, loadMore]);

  const currentSort = sortOptions.find((option) => option.value === sortKey);
  const hasFilters = gender !== "" || favoriteOnly;
  const favoriteCount = performers.filter((performer) => performer.favorite).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5">
            <Users className="h-5 w-5 text-text-accent" />
            Performers
          </h1>
          <p className="mt-1 text-[0.78rem] text-text-muted">
            Browse performers in your library
          </p>
        </div>
        <span className="mt-1 text-mono-sm text-text-disabled">
          {loading ? "..." : `${total} total`}
        </span>
      </div>

      {!loading && total > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="surface-stat px-3 py-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-text-disabled">
              <Users className="h-3.5 w-3.5" />
              <span className="text-kicker" style={{ color: "inherit" }}>
                Performers
              </span>
            </div>
            <div className="text-lg font-semibold leading-tight text-text-primary">{total}</div>
          </div>
          <div className="surface-stat px-3 py-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-text-disabled">
              <Star className="h-3.5 w-3.5" />
              <span className="text-kicker" style={{ color: "inherit" }}>
                Favorites
              </span>
            </div>
            <div className="text-lg font-semibold leading-tight text-text-primary">
              {favoriteCount}
            </div>
          </div>
          <div className="hidden surface-stat px-3 py-2.5 sm:block">
            <div className="mb-1 flex items-center gap-1.5 text-text-disabled">
              <Film className="h-3.5 w-3.5" />
              <span className="text-kicker" style={{ color: "inherit" }}>
                Showing
              </span>
            </div>
            <div className="text-lg font-semibold leading-tight text-text-primary">
              {performers.length}
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-0">
        <div className="surface-well flex items-center gap-2 px-3 py-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-disabled" />
            <input
              type="text"
              placeholder="Search performers..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={cn(
                "w-full bg-transparent py-1.5 pl-7 pr-3 text-[0.78rem] text-text-primary",
                "placeholder:text-text-disabled",
                "focus:outline-none",
                "transition-colors duration-fast",
              )}
            />
            {search ? (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-muted"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>

          {hasFilters ? (
            <div className="hidden items-center gap-1.5 border-l border-border-subtle pl-2 sm:flex">
              {gender ? (
                <span className="inline-flex items-center gap-1 whitespace-nowrap pill-accent px-2 py-0.5 text-[0.68rem]">
                  <span className="text-accent-400/70">Gender:</span>
                  <span className="text-accent-200">{gender}</span>
                  <button
                    onClick={() => setGender("")}
                    className="ml-0.5 text-accent-400/50 hover:text-accent-200 transition-colors duration-fast"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ) : null}
              {favoriteOnly ? (
                <span className="inline-flex items-center gap-1 whitespace-nowrap pill-accent px-2 py-0.5 text-[0.68rem]">
                  <Star className="h-2.5 w-2.5 fill-current text-accent-400" />
                  <span className="text-accent-200">Favorites</span>
                  <button
                    onClick={() => setFavoriteOnly(false)}
                    className="ml-0.5 text-accent-400/50 hover:text-accent-200 transition-colors duration-fast"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="h-5 w-px bg-border-subtle" />

          <div className="flex items-center">
            <div className="relative">
              <button
                onClick={() => setSortOpen((open) => !open)}
                className={cn(
                  "flex items-center gap-1.5 rounded-sm px-2 py-1.5",
                  "text-[0.72rem] text-text-muted hover:bg-surface-2 hover:text-text-primary",
                  "transition-colors duration-fast",
                )}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{currentSort?.label}</span>
                <ChevronDown className="h-3 w-3 text-text-disabled" />
              </button>

              {sortOpen ? (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-1 w-44 surface-elevated py-1">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          startTransition(() => {
                            setSortKey(option.value);
                            setSortDir(defaultSortDir[option.value]);
                            setSortOpen(false);
                          });
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[0.72rem] transition-colors duration-fast",
                          sortKey === option.value
                            ? "bg-accent-950 text-text-accent"
                            : "text-text-muted hover:bg-surface-3 hover:text-text-primary",
                        )}
                      >
                        <Check
                          className={cn(
                            "h-3 w-3",
                            sortKey === option.value ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <button
            onClick={() => setFilterOpen((open) => !open)}
            className={cn(
              "flex items-center gap-1.5 rounded-sm px-2 py-1.5",
              "text-[0.72rem] text-text-muted hover:bg-surface-2 hover:text-text-primary",
              "transition-colors duration-fast",
              hasFilters && "bg-accent-950 text-text-accent",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filters</span>
          </button>
        </div>

        {filterOpen ? (
          <div className="surface-card-sharp rounded-t-none border-t-0 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-kicker">Gender</label>
                <select
                  value={gender}
                  onChange={(event) => setGender(event.target.value)}
                  className="control-input w-full py-1.5 text-sm"
                >
                  {genderOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 pt-6 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={favoriteOnly}
                  onChange={(event) => setFavoriteOnly(event.target.checked)}
                  className="accent-[#c79b5c]"
                />
                Favorites only
              </label>
            </div>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="surface-well p-12 text-center text-sm text-text-muted">Loading performers…</div>
      ) : performers.length === 0 ? (
        <div className="surface-well p-12 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-text-disabled" />
          <p className="text-sm text-text-muted">
            {search || hasFilters
              ? "No performers match the current filters."
              : "No performers in the library yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {performers.map((performer) => (
            <PerformerEntityCard
              key={performer.id}
              performer={performerItemToCardData(performer)}
            />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {hasMore && !loading && <div ref={sentinelRef} className="h-1" />}
      {loadingMore && (
        <div className="flex justify-center py-4">
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading more...
          </div>
        </div>
      )}
    </div>
  );
}
