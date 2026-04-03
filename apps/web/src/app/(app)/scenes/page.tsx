"use client";

import { useState } from "react";
import { SceneGrid } from "../../../components/scene-grid";
import { FilterBar } from "../../../components/filter-bar";
import type { ViewMode, SortOption } from "../../../components/filter-bar";
import { Film, Clock, HardDrive, TrendingUp } from "lucide-react";

export default function ScenesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<
    { label: string; value: string }[]
  >([]);

  const removeFilter = (index: number) => {
    setActiveFilters((prev) => prev.filter((_, i) => i !== index));
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
          16 scenes
        </span>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard
          icon={<Film className="h-3.5 w-3.5" />}
          label="Total Scenes"
          value="16"
        />
        <StatCard
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Total Duration"
          value="6h 50m"
        />
        <StatCard
          icon={<HardDrive className="h-3.5 w-3.5" />}
          label="Storage"
          value="71.2 GB"
        />
        <StatCard
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="This Week"
          value="+4 new"
          accent
        />
      </div>

      {/* Filter toolbar */}
      <FilterBar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortBy={sortBy}
        onSortChange={setSortBy}
        activeFilters={activeFilters}
        onRemoveFilter={removeFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Scene grid / list */}
      <SceneGrid viewMode={viewMode} searchQuery={searchQuery} />
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
