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
  LayoutGrid,
  LayoutList,
  RotateCcw,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { Checkbox } from "@obscura/ui/primitives/checkbox";
import { cn } from "@obscura/ui/lib/utils";
import { fetchPerformers, updatePerformer, deletePerformer, type PerformerItem } from "../../lib/api";
import { useNsfw } from "../nsfw/nsfw-context";
import { PerformerEntityCard } from "../performers/performer-entity-card";
import { performerItemToCardData } from "../performers/performer-card-data";
import { useCurrentPath } from "../../hooks/use-current-path";

import { DashboardStatTile } from "../dashboard/dashboard-stat-tile";
import { DASHBOARD_STAT_GRADIENTS } from "../dashboard/dashboard-utils";
import { useSelection } from "../../hooks/use-selection";
import { SelectAllHeader } from "../select-all-header";
import { BulkActionToolbar } from "../bulk-action-toolbar";
import { ConfirmDeleteDialog } from "../confirm-delete-dialog";
import { useTerms } from "../../lib/terminology";
import type {
  PerformersListPrefs,
  PerformersPhotoFilter,
  PerformersSortKey,
  PerformersViewMode,
} from "../../lib/performers-list-prefs";
import {
  clearPerformersListPrefsCookie,
  defaultPerformersListPrefs,
  isDefaultPerformersListPrefs,
  performersListPrefsToFetchParams,
  writePerformersListPrefsCookie,
} from "../../lib/performers-list-prefs";

type SortDir = "asc" | "desc";

const defaultSortDir: Record<PerformersSortKey, SortDir> = {
  name: "asc",
  scenes: "desc",
  rating: "desc",
  recent: "desc",
};

const sortOptions: { value: PerformersSortKey; label: string }[] = [
  { value: "name", label: "Name A-Z" },
  { value: "scenes", label: "Video count" },
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
  initialListPrefs: PerformersListPrefs;
}

export function PerformersPageClient({
  initialPerformers,
  initialTotal,
  initialListPrefs,
}: PerformersPageClientProps) {
  const terms = useTerms();
  const { mode: nsfwMode } = useNsfw();
  const currentPath = useCurrentPath();
  const [viewMode, setViewMode] = useState<PerformersViewMode>(initialListPrefs.viewMode);
  const [performers, setPerformers] = useState(initialPerformers);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState(initialListPrefs.search);
  const [sortKey, setSortKey] = useState<PerformersSortKey>(initialListPrefs.sortKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialListPrefs.sortDir);
  const [gender, setGender] = useState(initialListPrefs.gender);
  const [favoriteOnly, setFavoriteOnly] = useState(initialListPrefs.favoriteOnly);
  const [minRating, setMinRating] = useState<number | null>(initialListPrefs.minRating);
  const [maxRating, setMaxRating] = useState<number | null>(initialListPrefs.maxRating);
  const [photoFilter, setPhotoFilter] = useState<PerformersPhotoFilter>(initialListPrefs.photoFilter);
  const [minSceneCount, setMinSceneCount] = useState<number | null>(initialListPrefs.minSceneCount);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const selection = useSelection();
  const [bulkLoading, setBulkLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const deferredSearch = useDeferredValue(search);
  const hydratedRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const hasMore = performers.length < total;

  // Full reload when filters/sort change
  const listPrefsSnapshot = useCallback(
    (): PerformersListPrefs => ({
      viewMode,
      search,
      sortKey,
      sortDir,
      gender,
      favoriteOnly,
      minRating,
      maxRating,
      photoFilter,
      minSceneCount,
    }),
    [
      viewMode,
      search,
      sortKey,
      sortDir,
      gender,
      favoriteOnly,
      minRating,
      maxRating,
      photoFilter,
      minSceneCount,
    ],
  );

  const loadPerformers = useCallback(async () => {
    setLoading(true);

    try {
      const base = performersListPrefsToFetchParams(
        { ...listPrefsSnapshot(), search: deferredSearch },
        nsfwMode,
      );
      const result = await fetchPerformers({ ...base, offset: 0 });

      setPerformers(result.performers);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to load performers:", error);
    } finally {
      setLoading(false);
    }
  }, [deferredSearch, listPrefsSnapshot, nsfwMode]);

  // Load more (append) for infinite scroll
  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return;
    setLoadingMore(true);

    try {
      const base = performersListPrefsToFetchParams(
        { ...listPrefsSnapshot(), search: deferredSearch },
        nsfwMode,
      );
      const result = await fetchPerformers({ ...base, offset: performers.length });

      setPerformers((prev) => [...prev, ...result.performers]);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to load more performers:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [deferredSearch, listPrefsSnapshot, loading, loadingMore, nsfwMode, performers.length]);

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }

    const timer = window.setTimeout(loadPerformers, deferredSearch ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [deferredSearch, loadPerformers]);

  useEffect(() => {
    const prefs = listPrefsSnapshot();
    if (isDefaultPerformersListPrefs(prefs)) {
      clearPerformersListPrefsCookie();
    } else {
      writePerformersListPrefsCookie(prefs);
    }
  }, [listPrefsSnapshot]);

  const handleClearFiltersAndSort = useCallback(() => {
    const d = defaultPerformersListPrefs();
    setViewMode(d.viewMode);
    setSearch(d.search);
    setSortKey(d.sortKey);
    setSortDir(d.sortDir);
    setGender(d.gender);
    setFavoriteOnly(d.favoriteOnly);
    setMinRating(d.minRating);
    setMaxRating(d.maxRating);
    setPhotoFilter(d.photoFilter);
    setMinSceneCount(d.minSceneCount);
    setFilterOpen(false);
  }, []);

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
  const hasFilters =
    gender !== "" ||
    favoriteOnly ||
    minRating != null ||
    maxRating != null ||
    photoFilter !== "all" ||
    minSceneCount != null;
  const favoriteCount = performers.filter((performer) => performer.favorite).length;
  const visibleIds = performers.map((p) => p.id);

  async function handleBulkNsfw(isNsfw: boolean) {
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selection.selectedIds).map((id) => updatePerformer(id, { isNsfw })),
      );
      selection.deselectAll();
      await loadPerformers();
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkDelete() {
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selection.selectedIds).map((id) => deletePerformer(id)),
      );
      selection.deselectAll();
      setDeleteDialogOpen(false);
      await loadPerformers();
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5">
            <Users className="h-5 w-5 text-text-accent" />
            {terms.performers}
          </h1>
          <p className="mt-1 text-[0.78rem] text-text-muted">
            Browse {terms.performers.toLowerCase()} in your library
          </p>
        </div>
        <span className="mt-1 text-mono-sm text-text-disabled">
          {loading ? "..." : `${total} total`}
        </span>
      </div>

      {!loading && total > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <DashboardStatTile
            icon={<Users className="h-4 w-4" />}
            label={terms.performers}
            value={String(total)}
            gradientClass={DASHBOARD_STAT_GRADIENTS[0]}
          />
          <DashboardStatTile
            icon={<Star className="h-4 w-4" />}
            label="Favorites"
            value={String(favoriteCount)}
            gradientClass={DASHBOARD_STAT_GRADIENTS[1]}
          />
          <div className="hidden sm:block">
            <DashboardStatTile
              icon={<Film className="h-4 w-4" />}
              label="Showing"
              value={String(performers.length)}
              gradientClass={DASHBOARD_STAT_GRADIENTS[2]}
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-0">
        <div className="surface-well flex items-center gap-2 px-3 py-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-disabled" />
            <input
              type="text"
              placeholder={`Search ${terms.performers.toLowerCase()}...`}
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
                    type="button"
                    onClick={() => setFavoriteOnly(false)}
                    className="ml-0.5 text-accent-400/50 hover:text-accent-200 transition-colors duration-fast"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ) : null}
              {minRating != null ? (
                <span className="inline-flex items-center gap-1 whitespace-nowrap pill-accent px-2 py-0.5 text-[0.68rem]">
                  <span className="text-accent-400/70">Min ★:</span>
                  <span className="text-accent-200">{minRating}+</span>
                  <button
                    type="button"
                    onClick={() => setMinRating(null)}
                    className="ml-0.5 text-accent-400/50 hover:text-accent-200 transition-colors duration-fast"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ) : null}
              {maxRating != null ? (
                <span className="inline-flex items-center gap-1 whitespace-nowrap pill-accent px-2 py-0.5 text-[0.68rem]">
                  <span className="text-accent-400/70">Max ★:</span>
                  <span className="text-accent-200">≤{maxRating}</span>
                  <button
                    type="button"
                    onClick={() => setMaxRating(null)}
                    className="ml-0.5 text-accent-400/50 hover:text-accent-200 transition-colors duration-fast"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ) : null}
              {photoFilter !== "all" ? (
                <span className="inline-flex items-center gap-1 whitespace-nowrap pill-accent px-2 py-0.5 text-[0.68rem]">
                  <span className="text-accent-400/70">Photo:</span>
                  <span className="text-accent-200">
                    {photoFilter === "with" ? "Has image" : "No image"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPhotoFilter("all")}
                    className="ml-0.5 text-accent-400/50 hover:text-accent-200 transition-colors duration-fast"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ) : null}
              {minSceneCount != null ? (
                <span className="inline-flex items-center gap-1 whitespace-nowrap pill-accent px-2 py-0.5 text-[0.68rem]">
                  <span className="text-accent-400/70">Videos:</span>
                  <span className="text-accent-200">{minSceneCount}+</span>
                  <button
                    type="button"
                    onClick={() => setMinSceneCount(null)}
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
                  "flex items-center gap-1.5 px-2 py-1.5",
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
              "flex items-center gap-1.5 px-2 py-1.5",
              "text-[0.72rem] text-text-muted hover:bg-surface-2 hover:text-text-primary",
              "transition-colors duration-fast",
              hasFilters && "bg-accent-950 text-text-accent",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filters</span>
          </button>

          <div className="h-5 w-px bg-border-subtle" />

          <div className="flex items-center">
            <button
              onClick={() => { setViewMode("grid"); selection.deselectAll(); }}
              className={cn(
                "flex h-7 w-7 items-center justify-center transition-colors duration-fast",
                viewMode === "grid" ? "text-text-accent bg-accent-950" : "text-text-muted hover:text-text-primary hover:bg-surface-2",
              )}
              title="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex h-7 w-7 items-center justify-center transition-colors duration-fast",
                viewMode === "list" ? "text-text-accent bg-accent-950" : "text-text-muted hover:text-text-primary hover:bg-surface-2",
              )}
              title="List view"
            >
              <LayoutList className="h-3.5 w-3.5" />
            </button>
          </div>

          {!isDefaultPerformersListPrefs(listPrefsSnapshot()) && (
            <button
              type="button"
              onClick={handleClearFiltersAndSort}
              title="Clear filters, sort, search, view, and saved preferences"
              className={cn(
                "flex items-center gap-1 px-2 py-1.5",
                "text-text-muted text-[0.72rem] hover:text-text-primary hover:bg-surface-2",
                "transition-colors duration-fast",
              )}
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          <div className="h-5 w-px bg-border-subtle" />

          <Link
            href="/performers/new"
            className={cn(
              "flex items-center gap-1 px-2 py-1.5",
              "text-text-accent text-[0.72rem] hover:text-text-accent-bright hover:bg-surface-2",
              "transition-colors duration-fast",
            )}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">New</span>
          </Link>
        </div>

        {filterOpen ? (
          <div className="surface-card-sharp border-t-0 p-3">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                <Checkbox
                  checked={favoriteOnly}
                  onChange={(event) => setFavoriteOnly(event.target.checked)}
                />
                Favorites only
              </label>
              <div>
                <div className="mb-1 text-kicker">Min rating</div>
                <div className="flex flex-wrap gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={`pmin-${n}`}
                      type="button"
                      onClick={() => setMinRating(minRating === n ? null : n)}
                      className={cn(
                        "tag-chip cursor-pointer transition-colors duration-fast",
                        minRating === n ? "tag-chip-accent" : "tag-chip-default hover:tag-chip-accent",
                      )}
                    >
                      {n}★+
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-kicker">Max rating</div>
                <div className="flex flex-wrap gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={`pmax-${n}`}
                      type="button"
                      onClick={() => setMaxRating(maxRating === n ? null : n)}
                      className={cn(
                        "tag-chip cursor-pointer transition-colors duration-fast",
                        maxRating === n ? "tag-chip-accent" : "tag-chip-default hover:tag-chip-accent",
                      )}
                    >
                      ≤{n}★
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-kicker">Profile image</label>
                <select
                  value={photoFilter}
                  onChange={(event) =>
                    setPhotoFilter(event.target.value as PerformersPhotoFilter)
                  }
                  className="control-input w-full py-1.5 text-sm"
                >
                  <option value="all">Any</option>
                  <option value="with">Has image</option>
                  <option value="without">No image</option>
                </select>
              </div>
              <div>
                <div className="mb-1 text-kicker">Min scene count</div>
                <div className="flex flex-wrap gap-1">
                  {[1, 3, 5, 10, 25].map((n) => (
                    <button
                      key={`psc-${n}`}
                      type="button"
                      onClick={() => setMinSceneCount(minSceneCount === n ? null : n)}
                      className={cn(
                        "tag-chip cursor-pointer transition-colors duration-fast",
                        minSceneCount === n ? "tag-chip-accent" : "tag-chip-default hover:tag-chip-accent",
                      )}
                    >
                      {n}+
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="surface-well p-12 text-center text-sm text-text-muted">Loading {terms.performers.toLowerCase()}…</div>
      ) : performers.length === 0 ? (
        <div className="surface-well p-12 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-text-disabled" />
          <p className="text-sm text-text-muted">
            {search || hasFilters
              ? `No ${terms.performers.toLowerCase()} match the current filters.`
              : `No ${terms.performers.toLowerCase()} in the library yet.`}
          </p>
        </div>
      ) : viewMode === "list" ? (
        <>
          <SelectAllHeader
            allSelected={selection.isAllSelected(visibleIds)}
            onToggle={() =>
              selection.isAllSelected(visibleIds)
                ? selection.deselectAll()
                : selection.selectAll(visibleIds)
            }
            selectedCount={selection.count}
            totalVisible={performers.length}
          />
          <div className="space-y-1">
            {performers.map((performer) => (
              <PerformerEntityCard
                key={performer.id}
                performer={performerItemToCardData(performer, currentPath)}
                variant="list"
                selected={selection.isSelected(performer.id)}
                onToggleSelect={selection.toggle}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {performers.map((performer) => (
            <PerformerEntityCard
              key={performer.id}
              performer={performerItemToCardData(performer, currentPath)}
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

      <BulkActionToolbar
        selectedCount={selection.count}
        onDeselectAll={selection.deselectAll}
        onMarkNsfw={() => void handleBulkNsfw(true)}
        onUnmarkNsfw={() => void handleBulkNsfw(false)}
        onDelete={() => setDeleteDialogOpen(true)}
        loading={bulkLoading}
      />

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        entityType="performer"
        count={selection.count}
        onDeleteFromLibrary={() => void handleBulkDelete()}
        loading={bulkLoading}
      />
    </div>
  );
}
