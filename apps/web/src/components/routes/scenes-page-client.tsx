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
  type SceneListItem,
  type SceneStats,
  type StudioItem,
  type TagItem,
} from "../../lib/api";

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
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [scenes, setScenes] = useState(initialScenes);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

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
    };
  }, [activeFilters, deferredSearchQuery, sortBy, sortDir]);

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

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5">
            <Film className="h-5 w-5 text-text-accent" />
            Scenes
          </h1>
          <p className="mt-1 text-[0.78rem] text-text-muted">
            Browse and manage your media library
          </p>
        </div>
        <span className="mt-1 text-mono-sm text-text-disabled">
          {total} scene{total !== 1 ? "s" : ""}
        </span>
      </div>

      {initialStats ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard
            icon={<Film className="h-3.5 w-3.5" />}
            label="Total Scenes"
            value={String(initialStats.totalScenes)}
          />
          <StatCard
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Total Duration"
            value={initialStats.totalDurationFormatted}
          />
          <StatCard
            icon={<HardDrive className="h-3.5 w-3.5" />}
            label="Storage"
            value={initialStats.totalSizeFormatted ?? "—"}
          />
          <StatCard
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="This Week"
            value={`+${initialStats.recentCount} new`}
            accent
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
        availableStudios={initialStudios}
        availableTags={initialTags}
        onAddFilter={addFilter}
      />

      <SceneGrid
        scenes={scenes}
        viewMode={viewMode}
        loading={loading}
        hasMore={scenes.length < total}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
      />
    </div>
  );
}

function StatCard({
  accent,
  icon,
  label,
  value,
}: {
  accent?: boolean;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className={accent ? "surface-stat-accent px-3 py-2.5" : "surface-stat px-3 py-2.5"}>
      <div
        className={`mb-1 flex items-center gap-1.5 ${accent ? "text-text-accent" : "text-text-disabled"}`}
      >
        {icon}
        <span className="text-kicker" style={{ color: "inherit" }}>
          {label}
        </span>
      </div>
      <div
        className={
          accent
            ? "text-lg font-semibold leading-tight text-text-accent"
            : "text-lg font-semibold leading-tight text-text-primary"
        }
      >
        {value}
      </div>
    </div>
  );
}
