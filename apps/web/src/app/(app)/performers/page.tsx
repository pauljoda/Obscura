"use client";

import { useEffect, useState, useMemo } from "react";
import { Users, Star, Search, Loader2, SortAsc, SortDesc } from "lucide-react";
import Link from "next/link";
import { fetchPerformers, type PerformerItem } from "../../../lib/api";

type SortKey = "name" | "scenes";
type SortDir = "asc" | "desc";

export default function PerformersPage() {
  const [performers, setPerformers] = useState<PerformerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("scenes");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    fetchPerformers()
      .then((r) => setPerformers(r.performers))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = performers;
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(term));
    }
    return [...list].sort((a, b) => {
      if (sortKey === "name") {
        const cmp = a.name.localeCompare(b.name);
        return sortDir === "asc" ? cmp : -cmp;
      }
      const cmp = a.sceneCount - b.sceneCount;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [performers, search, sortKey, sortDir]);

  const favoriteCount = performers.filter((p) => p.favorite).length;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5">
            <Users className="h-5 w-5 text-text-accent" />
            Performers
          </h1>
          <p className="text-text-muted text-[0.78rem] mt-1">
            Browse performers in your library
          </p>
        </div>
        <span className="text-mono-sm text-text-disabled mt-1">
          {loading ? "…" : `${performers.length} total`}
        </span>
      </div>

      {/* Stats strip */}
      {!loading && performers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="surface-stat px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1 text-text-disabled">
              <Users className="h-3.5 w-3.5" />
              <span className="text-kicker" style={{ color: "inherit" }}>Performers</span>
            </div>
            <div className="text-lg font-semibold text-text-primary leading-tight">
              {performers.length}
            </div>
          </div>
          <div className="surface-stat px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1 text-text-disabled">
              <Star className="h-3.5 w-3.5" />
              <span className="text-kicker" style={{ color: "inherit" }}>Favorites</span>
            </div>
            <div className="text-lg font-semibold text-text-primary leading-tight">
              {favoriteCount}
            </div>
          </div>
          <div className="surface-stat px-3 py-2.5 hidden sm:block">
            <div className="flex items-center gap-1.5 mb-1 text-text-disabled">
              <Users className="h-3.5 w-3.5" />
              <span className="text-kicker" style={{ color: "inherit" }}>Showing</span>
            </div>
            <div className="text-lg font-semibold text-text-primary leading-tight">
              {filtered.length}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="surface-well flex items-center gap-2 p-2">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled pointer-events-none" />
          <input
            type="text"
            placeholder="Search performers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="control-input w-full pl-8 pr-3 py-1.5 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => toggleSort("name")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-all duration-fast ${
              sortKey === "name"
                ? "bg-accent-950 text-text-accent border border-border-accent"
                : "text-text-muted hover:text-text-secondary border border-transparent"
            }`}
          >
            {sortKey === "name" && sortDir === "desc" ? (
              <SortDesc className="h-3 w-3" />
            ) : (
              <SortAsc className="h-3 w-3" />
            )}
            Name
          </button>
          <button
            onClick={() => toggleSort("scenes")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-all duration-fast ${
              sortKey === "scenes"
                ? "bg-accent-950 text-text-accent border border-border-accent"
                : "text-text-muted hover:text-text-secondary border border-transparent"
            }`}
          >
            {sortKey === "scenes" && sortDir === "desc" ? (
              <SortDesc className="h-3 w-3" />
            ) : (
              <SortAsc className="h-3 w-3" />
            )}
            Scenes
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="surface-well p-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-text-disabled animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-well p-12 text-center">
          <Users className="h-10 w-10 text-text-disabled mx-auto mb-3" />
          <p className="text-text-muted text-sm">
            {search ? "No performers match your search." : "No performers in the library yet."}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((performer) => (
            <PerformerCard key={performer.id} performer={performer} />
          ))}
        </div>
      )}
    </div>
  );
}

function PerformerCard({ performer }: { performer: PerformerItem }) {
  const initials = performer.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Link href={`/performers/${performer.id}`}>
      <article className="surface-card p-4 text-center group cursor-pointer h-full">
        <div className="mx-auto mb-3 relative">
          <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-surface-3 text-2xl font-semibold font-heading text-text-muted group-hover:text-text-accent group-hover:bg-accent-950 transition-all duration-fast">
            {initials}
          </div>
          {performer.favorite && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-950 border border-border-accent">
              <Star className="h-2.5 w-2.5 text-text-accent fill-current" />
            </span>
          )}
        </div>
        <h3 className="text-sm font-medium truncate group-hover:text-text-accent transition-colors duration-fast">
          {performer.name}
        </h3>
        <p className="text-mono-sm text-text-disabled mt-1">
          {performer.sceneCount} scene{performer.sceneCount !== 1 ? "s" : ""}
        </p>
      </article>
    </Link>
  );
}
