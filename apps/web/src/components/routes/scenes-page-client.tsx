"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Film, Clock, HardDrive, TrendingUp } from "lucide-react";
import { SceneGrid } from "../scene-grid";
import { FilterBar } from "../filter-bar";
import type { SortDir, SortOption, ViewMode } from "../filter-bar";
import {
  fetchScenes,
  fetchSceneStats,
  fetchStudios,
  fetchTags,
  updateScene,
  deleteScene,
  type SceneListItem,
  type SceneStats,
  type StudioItem,
  type TagItem,
} from "../../lib/api";
import { useNsfw } from "../nsfw/nsfw-context";
import { useTerms } from "../../lib/terminology";
import { cn } from "@obscura/ui/lib/utils";
import { DASHBOARD_STAT_GRADIENTS } from "../dashboard/dashboard-utils";
import { useSelection } from "../../hooks/use-selection";
import { SelectAllHeader } from "../select-all-header";
import { BulkActionToolbar } from "../bulk-action-toolbar";
import { ConfirmDeleteDialog } from "../confirm-delete-dialog";

interface ActiveFilter {
  label: string;
  type: string;
  value: string;
}

interface ScenesPageClientProps {
  initialScenes: SceneListItem[];
  initialStats: SceneStats | null;
  initialStudios: StudioItem[];
  initialTags: TagItem[];
  initialTotal: number;
}

export function ScenesPageClient({
  initialScenes,
  initialStats,
  initialStudios,
  initialTags,
  initialTotal,
}: ScenesPageClientProps) {
  const { mode: nsfwMode } = useNsfw();
  const terms = useTerms();
  const [stats, setStats] = useState(initialStats);

  useEffect(() => {
    setStats(initialStats);
  }, [initialStats]);

  useEffect(() => {
    void fetchSceneStats(nsfwMode)
      .then(setStats)
      .catch(() => {});
  }, [nsfwMode]);

  const skipFirstFilterRefetch = useRef(true);
  useEffect(() => {
    if (skipFirstFilterRefetch.current) {
      skipFirstFilterRefetch.current = false;
      return;
    }
    void Promise.all([fetchStudios({ nsfw: nsfwMode }), fetchTags({ nsfw: nsfwMode })])
      .then(([s, t]) => {
        setFilterStudios(s.studios);
        setFilterTags(t.tags);
      })
      .catch(() => {});
  }, [nsfwMode]);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [scenes, setScenes] = useState(initialScenes);
  const [total, setTotal] = useState(initialTotal);
  const [filterStudios, setFilterStudios] = useState(initialStudios);
  const [filterTags, setFilterTags] = useState(initialTags);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const selection = useSelection();
  const [bulkLoading, setBulkLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const hydratedRef = useRef(false);

  const buildParams = useCallback(() => {
    const tagFilters = activeFilters
      .filter((filter) => filter.type === "tag")
      .map((filter) => filter.value);
    const performerFilters = activeFilters
      .filter((filter) => filter.type === "performer")
      .map((filter) => filter.value);
    const resolutionFilter = activeFilters.find((filter) => filter.type === "resolution");
    const studioFilter = activeFilters.find((filter) => filter.type === "studio");

    return {
      search: deferredSearchQuery || undefined,
      sort: sortBy,
      order: sortDir,
      tag: tagFilters.length > 0 ? tagFilters : undefined,
      performer: performerFilters.length > 0 ? performerFilters : undefined,
      resolution: resolutionFilter?.value,
      studio: studioFilter?.value,
      nsfw: nsfwMode,
    };
  }, [activeFilters, deferredSearchQuery, sortBy, sortDir, nsfwMode]);

  const loadScenes = useCallback(async () => {
    setLoading(true);

    try {
      const result = await fetchScenes({
        ...buildParams(),
        limit: 50,
      });

      setScenes(result.scenes);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to load scenes:", error);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const loadMore = useCallback(async () => {
    if (loadingMore || scenes.length >= total) return;
    setLoadingMore(true);

    try {
      const result = await fetchScenes({
        ...buildParams(),
        limit: 50,
        offset: scenes.length,
      });

      setScenes((prev) => {
        const existingIds = new Set(prev.map((s) => s.id));
        const newItems = result.scenes.filter((s) => !existingIds.has(s.id));
        return [...prev, ...newItems];
      });
    } catch (error) {
      console.error("Failed to load more scenes:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [buildParams, scenes.length, total, loadingMore]);

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }

    const timer = window.setTimeout(loadScenes, deferredSearchQuery ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [deferredSearchQuery, loadScenes]);

  function removeFilter(index: number) {
    startTransition(() => {
      setActiveFilters((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
    });
  }

  function addFilter(type: string, label: string, value: string) {
    startTransition(() => {
      setActiveFilters((previous) => {
        if (previous.some((filter) => filter.type === type && filter.value === value)) {
          return previous;
        }

        if (type === "resolution" || type === "studio") {
          return [...previous.filter((filter) => filter.type !== type), { type, label, value }];
        }

        return [...previous, { type, label, value }];
      });
    });
  }

  async function handleBulkNsfw(isNsfw: boolean) {
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selection.selectedIds).map((id) => updateScene(id, { isNsfw })),
      );
      selection.deselectAll();
      await loadScenes();
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkDelete(deleteFile?: boolean) {
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selection.selectedIds).map((id) => deleteScene(id, deleteFile)),
      );
      selection.deselectAll();
      setDeleteDialogOpen(false);
      await loadScenes();
    } finally {
      setBulkLoading(false);
    }
  }

  const visibleIds = scenes.map((s) => s.id);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5">
            <Film className="h-5 w-5 text-text-accent" />
            {terms.scenes}
          </h1>
          <p className="mt-1 text-[0.78rem] text-text-muted">
            Browse and manage your media library
          </p>
        </div>
        <span className="mt-1 text-mono-sm text-text-disabled">
          {total}{" "}
          {total === 1 ? terms.scene.toLowerCase() : terms.scenes.toLowerCase()}
        </span>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <StatCard
            icon={<Film className="h-4 w-4" />}
            label={`Total ${terms.scenes}`}
            value={String(stats.totalScenes)}
            gradientClass={DASHBOARD_STAT_GRADIENTS[0]}
          />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label="Total Duration"
            value={stats.totalDurationFormatted}
            gradientClass={DASHBOARD_STAT_GRADIENTS[1]}
          />
          <StatCard
            icon={<HardDrive className="h-4 w-4" />}
            label="Storage"
            value={stats.totalSizeFormatted ?? "—"}
            gradientClass={DASHBOARD_STAT_GRADIENTS[2]}
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="This Week"
            value={`+${stats.recentCount}`}
            accent
            gradientClass={DASHBOARD_STAT_GRADIENTS[3]}
          />
        </div>
      ) : null}

      <FilterBar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={(sort, dir) => {
          startTransition(() => {
            setSortBy(sort);
            if (dir) {
              setSortDir(dir);
            }
          });
        }}
        activeFilters={activeFilters.map((filter) => ({
          label: filter.label,
          value: filter.value,
        }))}
        onRemoveFilter={removeFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        availableStudios={filterStudios}
        availableTags={filterTags}
        onAddFilter={addFilter}
      />

      {viewMode === "list" && !loading && scenes.length > 0 && (
        <SelectAllHeader
          allSelected={selection.isAllSelected(visibleIds)}
          onToggle={() =>
            selection.isAllSelected(visibleIds)
              ? selection.deselectAll()
              : selection.selectAll(visibleIds)
          }
          selectedCount={selection.count}
          totalVisible={scenes.length}
        />
      )}

      <SceneGrid
        scenes={scenes}
        viewMode={viewMode}
        loading={loading}
        hasMore={scenes.length < total}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
        selectedIds={viewMode === "list" ? selection.selectedIds : undefined}
        onToggleSelect={viewMode === "list" ? selection.toggle : undefined}
      />

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
        entityType="scene"
        count={selection.count}
        onDeleteFromLibrary={() => void handleBulkDelete(false)}
        onDeleteFromDisk={() => void handleBulkDelete(true)}
        loading={bulkLoading}
      />
    </div>
  );
}

function StatCard({
  accent,
  icon,
  label,
  value,
  gradientClass,
}: {
  accent?: boolean;
  icon: ReactNode;
  label: string;
  value: string;
  gradientClass: string;
}) {
  return (
    <div
      className={cn(
        "surface-panel relative overflow-hidden px-3 py-2.5 flex flex-col justify-between min-h-[72px]",
        accent && "border-border-accent shadow-[var(--shadow-glow-accent)]"
      )}
    >
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[3px] opacity-90",
          gradientClass
        )}
      />
      <div className="flex items-center justify-between ml-1.5">
        <span className="text-[0.6rem] font-semibold tracking-[0.15em] uppercase text-text-muted">
          {label}
        </span>
        <div className={cn("opacity-70", accent ? "text-text-accent" : "text-text-disabled")}>
          {icon}
        </div>
      </div>
      <div
        className={cn(
          "ml-1.5 mt-1 text-lg font-mono tracking-tight",
          accent ? "text-glow-accent" : "text-text-primary"
        )}
      >
        {value}
      </div>
    </div>
  );
}
