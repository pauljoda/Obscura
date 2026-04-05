"use client";

import { useState, useMemo } from "react";
import { Building2, Search, SortAsc, SortDesc } from "lucide-react";
import Link from "next/link";
import type { StudioItem } from "../../lib/api";

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
            <StudioCard key={studio.id} studio={studio} />
          ))}
        </div>
      )}
    </div>
  );
}

function StudioCard({ studio }: { studio: StudioItem }) {
  const initials = studio.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Link href={`/studios/${studio.id}`}>
      <article className="surface-card p-4 flex items-center gap-4 group cursor-pointer h-full">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-surface-3 group-hover:bg-accent-950 transition-all duration-fast">
          <span className="text-sm font-semibold font-heading text-text-muted group-hover:text-text-accent transition-colors duration-fast">
            {initials}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium truncate group-hover:text-text-accent transition-colors duration-fast">
            {studio.name}
          </h3>
          <p className="text-mono-sm text-text-disabled mt-0.5">Browse scenes</p>
        </div>
        <Building2 className="h-4 w-4 text-text-disabled flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-fast" />
      </article>
    </Link>
  );
}
