"use client";

import { useState, useEffect, useCallback } from "react";
import { SceneGrid } from "../../../components/scene-grid";
import { FilterBar } from "../../../components/filter-bar";
import type { ViewMode, SortOption, SortDir } from "../../../components/filter-bar";
import { Film, Clock, HardDrive, TrendingUp } from "lucide-react";
import {
  fetchScenes,
  fetchSceneStats,
  fetchStudios,
  fetchTags,
  type SceneListItem,
  type SceneStats,
  type StudioItem,
  type TagItem,
} from "../../../lib/api";

export default function ScenesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<
    { label: string; value: string; type: string }[]
  >([]);

  const [scenes, setScenes] = useState<SceneListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<SceneStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter option data from API
  const [availableStudios, setAvailableStudios] = useState<StudioItem[]>([]);
  const [availableTags, setAvailableTags] = useState<TagItem[]>([]);

  // Load filter options on mount
  useEffect(() => {
    fetchStudios().then((r) => setAvailableStudios(r.studios));
    fetchTags().then((r) => setAvailableTags(r.tags));
    fetchSceneStats().then(setStats);
  }, []);

  // Load scenes when filters change
  const loadScenes = useCallback(async () => {
    setLoading(true);
    try {
      const tagFilters = activeFilters
        .filter((f) => f.type === "tag")
        .map((f) => f.value);
      const perfFilters = activeFilters
        .filter((f) => f.type === "performer")
        .map((f) => f.value);
      const resFilter = activeFilters.find((f) => f.type === "resolution");
      const studioFilter = activeFilters.find((f) => f.type === "studio");

      const result = await fetchScenes({
        search: searchQuery || undefined,
        sort: sortBy,
        order: sortDir,
        tag: tagFilters.length > 0 ? tagFilters : undefined,
        performer: perfFilters.length > 0 ? perfFilters : undefined,
        resolution: resFilter?.value,
        studio: studioFilter?.value,
        limit: 50,
      });
      setScenes(result.scenes);
      setTotal(result.total);
    } catch (err) {
      console.error("Failed to load scenes:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, sortBy, sortDir, activeFilters]);

  useEffect(() => {
    const timer = setTimeout(loadScenes, searchQuery ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadScenes, searchQuery]);

  const removeFilter = (index: number) => {
    setActiveFilters((prev) => prev.filter((_, i) => i !== index));
  };

  const addFilter = (type: string, label: string, value: string) => {
    setActiveFilters((prev) => {
      // Don't add duplicates
      if (prev.some((f) => f.type === type && f.value === value)) return prev;
      // For resolution/studio, replace existing
      if (type === "resolution" || type === "studio") {
        return [...prev.filter((f) => f.type !== type), { type, label, value }];
      }
      return [...prev, { type, label, value }];
    });
  };

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5">
            <Film className="h-5 w-5 text-text-accent" />
            Scenes
          </h1>
          <p className="text-text-muted text-[0.78rem] mt-1">
            Browse and manage your media library
          </p>
        </div>
        <span className="text-mono-sm text-text-disabled mt-1">
          {total} scene{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard
            icon={<Film className="h-3.5 w-3.5" />}
            label="Total Scenes"
            value={String(stats.totalScenes)}
          />
          <StatCard
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Total Duration"
            value={stats.totalDurationFormatted}
          />
          <StatCard
            icon={<HardDrive className="h-3.5 w-3.5" />}
            label="Storage"
            value={stats.totalSizeFormatted ?? "—"}
          />
          <StatCard
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="This Week"
            value={`+${stats.recentCount} new`}
            accent
          />
        </div>
      )}

      {/* Filter toolbar */}
      <FilterBar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={(sort, dir) => {
          setSortBy(sort);
          if (dir) setSortDir(dir);
        }}
        activeFilters={activeFilters.map((f) => ({
          label: f.label,
          value: f.value,
        }))}
        onRemoveFilter={removeFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        availableStudios={availableStudios}
        availableTags={availableTags}
        onAddFilter={addFilter}
      />

      {/* Scene grid / list */}
      <SceneGrid
        scenes={scenes}
        viewMode={viewMode}
        loading={loading}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={accent ? "surface-stat-accent px-3 py-2.5" : "surface-stat px-3 py-2.5"}>
      <div className={`flex items-center gap-1.5 mb-1 ${accent ? "text-text-accent" : "text-text-disabled"}`}>
        {icon}
        <span className="text-kicker" style={{ color: "inherit" }}>
          {label}
        </span>
      </div>
      <div
        className={
          accent
            ? "text-lg font-semibold text-text-accent leading-tight"
            : "text-lg font-semibold text-text-primary leading-tight"
        }
      >
        {value}
      </div>
    </div>
  );
}
