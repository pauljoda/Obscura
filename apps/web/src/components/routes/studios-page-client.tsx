"use client";

import { useState, useMemo } from "react";
import { Building2, Search, SortAsc, SortDesc } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { type StudioItem } from "../../lib/api";
import { StudioEntityCard } from "../studios/studio-entity-card";
import { studioItemToCardData } from "../studios/studio-card-data";

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

      {/* Toolbar */}
      <div className="surface-well flex items-center gap-2 p-2">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled pointer-events-none" />
          <input
            type="text"
            placeholder="Search studios…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="control-input w-full pl-8 pr-3 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs bg-accent-950 text-text-accent border border-border-accent transition-all duration-fast"
        >
          {sortDir === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />}
          Name
        </button>
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
