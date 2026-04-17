"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Building2,
  Search,
  X,
  ArrowUpDown,
  ChevronDown,
  LayoutGrid,
  LayoutList,
  RotateCcw,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { Checkbox } from "@obscura/ui/primitives/checkbox";
import { cn } from "@obscura/ui/lib/utils";
import { fetchStudios, type StudioItem, updateStudio, deleteStudio } from "../../lib/api";
import { useNsfw } from "../nsfw/nsfw-context";
import { StudioEntityCard } from "../studios/studio-entity-card";
import { studioItemToCardData } from "../studios/studio-card-data";
import { useCurrentPath } from "../../hooks/use-current-path";

import { DashboardStatTile } from "../dashboard/dashboard-stat-tile";
import { DASHBOARD_STAT_GRADIENTS } from "../dashboard/dashboard-utils";
import { useSelection } from "../../hooks/use-selection";
import { SelectAllHeader } from "../select-all-header";
import { BulkActionToolbar } from "../bulk-action-toolbar";
import { ConfirmDeleteDialog } from "../confirm-delete-dialog";
import type { StudiosListPrefs, StudiosViewMode } from "../../lib/studios-list-prefs";
import {
  defaultStudiosListPrefs,
  isDefaultStudiosListPrefs,
  writeStudiosListPrefsCookie,
  clearStudiosListPrefsCookie,
} from "../../lib/studios-list-prefs";

type SortDir = "asc" | "desc";

interface StudiosPageClientProps {
  initialStudios: StudioItem[];
  initialListPrefs: StudiosListPrefs;
}

export function StudiosPageClient({ initialStudios, initialListPrefs }: StudiosPageClientProps) {
  const { mode: nsfwMode } = useNsfw();
  const currentPath = useCurrentPath();
  const [studios, setStudios] = useState(initialStudios);
  const skipFirstStudioRefetch = useRef(true);

  useEffect(() => {
    if (skipFirstStudioRefetch.current) {
      skipFirstStudioRefetch.current = false;
      return;
    }
    void fetchStudios({ nsfw: nsfwMode })
      .then((r) => setStudios(r.studios))
      .catch(() => {});
  }, [nsfwMode]);
  const [search, setSearch] = useState(initialListPrefs.search);
  const [sortDir, setSortDir] = useState<SortDir>(initialListPrefs.sortDir);
  const [viewMode, setViewMode] = useState<StudiosViewMode>(initialListPrefs.viewMode);
  const [minSceneCount, setMinSceneCount] = useState(initialListPrefs.minSceneCount);
  const [minRatingStars, setMinRatingStars] = useState<number | null>(initialListPrefs.minRatingStars);
  const [favoritesOnly, setFavoritesOnly] = useState(initialListPrefs.favoritesOnly);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    const prefs: StudiosListPrefs = {
      search,
      sortDir,
      viewMode,
      minSceneCount,
      minRatingStars,
      favoritesOnly,
    };
    if (isDefaultStudiosListPrefs(prefs)) {
      clearStudiosListPrefsCookie();
    } else {
      writeStudiosListPrefsCookie(prefs);
    }
  }, [search, sortDir, viewMode, minSceneCount, minRatingStars, favoritesOnly]);

  const selection = useSelection();

  const handleClearFiltersAndSort = useCallback(() => {
    const d = defaultStudiosListPrefs();
    setSearch(d.search);
    setSortDir(d.sortDir);
    setViewMode(d.viewMode);
    setMinSceneCount(d.minSceneCount);
    setMinRatingStars(d.minRatingStars);
    setFavoritesOnly(d.favoritesOnly);
    setFilterOpen(false);
    selection.deselectAll();
  }, [selection]);

  const [bulkLoading, setBulkLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = studios;
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(term));
    }
    if (minSceneCount > 0) {
      list = list.filter((s) => s.videoCount >= minSceneCount);
    }
    if (minRatingStars != null) {
      list = list.filter((s) => s.rating != null && s.rating >= minRatingStars);
    }
    if (favoritesOnly) {
      list = list.filter((s) => s.favorite);
    }
    return [...list].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [studios, search, sortDir, minSceneCount, minRatingStars, favoritesOnly]);

  const visibleIds = filtered.map((s) => s.id);

  async function handleBulkNsfw(isNsfw: boolean) {
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selection.selectedIds).map((id) => updateStudio(id, { isNsfw })),
      );
      setStudios((prev) =>
        prev.map((s) =>
          selection.selectedIds.has(s.id) ? { ...s, isNsfw } : s,
        ),
      );
      selection.deselectAll();
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkDelete() {
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selection.selectedIds).map((id) => deleteStudio(id)),
      );
      setStudios((prev) => prev.filter((s) => !selection.selectedIds.has(s.id)));
      selection.deselectAll();
      setDeleteDialogOpen(false);
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5">
            <Building2 className="h-5 w-5 text-text-accent" />
            Studios
          </h1>
          <p className="text-text-muted text-[0.78rem] mt-1">
            Browse studios in your library
          </p>
        </div>
        <span className="text-mono-sm text-text-disabled mt-1">
          {studios.length} total
        </span>
      </div>

      {/* Inline stats */}
      {studios.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <DashboardStatTile
            icon={<Building2 className="h-4 w-4" />}
            label="Total Studios"
            value={String(studios.length)}
            gradientClass={DASHBOARD_STAT_GRADIENTS[0]}
          />
          <DashboardStatTile
            icon={<Search className="h-4 w-4" />}
            label="Showing"
            value={String(filtered.length)}
            gradientClass={DASHBOARD_STAT_GRADIENTS[1]}
          />
        </div>
      )}

      {/* Toolbar */}
      <div className="space-y-0">
        <div className="surface-well flex items-center gap-2 px-3 py-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-disabled" />
            <input
              type="text"
              placeholder="Search studios…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

          <div className="h-5 w-px bg-border-subtle" />

          <div className="flex items-center">
            <button
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              title={sortDir === "asc" ? "Ascending" : "Descending"}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1.5",
                "text-[0.72rem] text-text-muted hover:bg-surface-2 hover:text-text-primary",
                "transition-colors duration-fast",
              )}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Name</span>
              <ChevronDown className={cn("h-3 w-3 text-text-disabled", sortDir === "asc" && "rotate-180")} />
            </button>
          </div>

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

          <div className="h-5 w-px bg-border-subtle" />

          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 text-[0.72rem] transition-colors duration-fast",
              filterOpen || minSceneCount > 0 || minRatingStars != null || favoritesOnly
                ? "text-text-accent bg-accent-950"
                : "text-text-muted hover:text-text-primary hover:bg-surface-2",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filters</span>
          </button>

          {!isDefaultStudiosListPrefs({
            search,
            sortDir,
            viewMode,
            minSceneCount,
            minRatingStars,
            favoritesOnly,
          }) && (
            <button
              type="button"
              onClick={handleClearFiltersAndSort}
              title="Clear search, sort, view, and saved preferences"
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
            href="/studios/new"
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

        {studios.length > 0 && filterOpen ? (
          <div className="surface-well mt-px p-3">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <div className="text-kicker mb-2">Min video count</div>
                <div className="flex flex-wrap gap-1">
                  {[
                    { n: 0, label: "Any" },
                    { n: 1, label: "1+" },
                    { n: 3, label: "3+" },
                    { n: 5, label: "5+" },
                    { n: 10, label: "10+" },
                    { n: 25, label: "25+" },
                  ].map(({ n, label }) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMinSceneCount(n)}
                      className={cn(
                        "tag-chip cursor-pointer transition-colors duration-fast",
                        minSceneCount === n ? "tag-chip-accent" : "tag-chip-default hover:tag-chip-accent",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-kicker mb-2">Min star rating</div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setMinRatingStars(null)}
                    className={cn(
                      "tag-chip cursor-pointer transition-colors duration-fast",
                      minRatingStars === null ? "tag-chip-accent" : "tag-chip-default hover:tag-chip-accent",
                    )}
                  >
                    Any
                  </button>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMinRatingStars(minRatingStars === n ? null : n)}
                      className={cn(
                        "tag-chip cursor-pointer transition-colors duration-fast",
                        minRatingStars === n ? "tag-chip-accent" : "tag-chip-default hover:tag-chip-accent",
                      )}
                    >
                      {n}★+
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-text-secondary pt-1">
                <Checkbox
                  checked={favoritesOnly}
                  onChange={(e) => setFavoritesOnly(e.target.checked)}
                />
                Favorites only
              </label>
            </div>
          </div>
        ) : null}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="surface-well p-12 text-center">
          <Building2 className="h-10 w-10 text-text-disabled mx-auto mb-3" />
          <p className="text-text-muted text-sm">
            {studios.length === 0
              ? "No studios in the library yet."
              : search || minSceneCount > 0 || minRatingStars != null || favoritesOnly
                ? "No studios match the current filters."
                : "No studios in the library yet."}
          </p>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-text-accent text-xs mt-2 hover:text-text-accent-bright transition-colors duration-fast"
            >
              Clear search
            </button>
          )}
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
            totalVisible={filtered.length}
          />
          <div className="space-y-1">
            {filtered.map((studio) => (
              <StudioEntityCard
                key={studio.id}
                studio={studioItemToCardData(studio, currentPath)}
                variant="list"
                selected={selection.isSelected(studio.id)}
                onToggleSelect={selection.toggle}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((studio) => (
            <StudioEntityCard key={studio.id} studio={studioItemToCardData(studio, currentPath)} />
          ))}
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
        entityType="studio"
        count={selection.count}
        onDeleteFromLibrary={() => void handleBulkDelete()}
        loading={bulkLoading}
      />
    </div>
  );
}
