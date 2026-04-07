"use client";

import { useState, useMemo } from "react";
import { Building2, Search, X, ArrowUpDown, ChevronDown } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { type StudioItem } from "../../lib/api";
import { StudioEntityCard } from "../studios/studio-entity-card";
import { studioItemToCardData } from "../studios/studio-card-data";

import { DashboardStatTile } from "../dashboard/dashboard-stat-tile";
import { DASHBOARD_STAT_GRADIENTS } from "../dashboard/dashboard-utils";

type SortDir = "asc" | "desc";

interface StudiosPageClientProps {
  initialStudios: StudioItem[];
}

export function StudiosPageClient({ initialStudios }: StudiosPageClientProps) {
  const [studios] = useState(initialStudios);
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    let list = studios;
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(term));
    }
    return [...list].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [studios, search, sortDir]);

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
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="surface-well p-12 text-center">
          <Building2 className="h-10 w-10 text-text-disabled mx-auto mb-3" />
          <p className="text-text-muted text-sm">
            {search ? "No studios match your search." : "No studios in the library yet."}
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((studio) => (
            <StudioEntityCard key={studio.id} studio={studioItemToCardData(studio)} />
          ))}
        </div>
      )}
    </div>
  );
}
