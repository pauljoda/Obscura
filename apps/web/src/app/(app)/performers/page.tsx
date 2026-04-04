"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Star,
  Search,
  Loader2,
  ArrowUpDown,
  ChevronDown,
  Check,
  X,
  SlidersHorizontal,
  Film,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@obscura/ui";
import {
  fetchPerformers,
  toApiUrl,
  type PerformerItem,
} from "../../../lib/api";

type SortKey = "name" | "scenes" | "rating" | "recent";
type SortDir = "asc" | "desc";

const defaultSortDir: Record<SortKey, SortDir> = {
  name: "asc",
  scenes: "desc",
  rating: "desc",
  recent: "desc",
};

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "name", label: "Name A-Z" },
  { value: "scenes", label: "Scene Count" },
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

export default function PerformersPage() {
  const [performers, setPerformers] = useState<PerformerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("scenes");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [gender, setGender] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [page, setPage] = useState(0);

  // Dropdown states
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const loadPerformers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchPerformers({
        search: search || undefined,
        sort: sortKey,
        order: sortDir,
        gender: gender || undefined,
        favorite: favoriteOnly ? "true" : undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setPerformers(result.performers);
      setTotal(result.total);
    } catch (err) {
      console.error("Failed to load performers:", err);
    } finally {
      setLoading(false);
    }
  }, [search, sortKey, sortDir, gender, favoriteOnly, page]);

  // Debounced search, instant for other changes
  useEffect(() => {
    const timer = setTimeout(loadPerformers, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadPerformers, search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [search, sortKey, sortDir, gender, favoriteOnly]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentSort = sortOptions.find((s) => s.value === sortKey);
  const hasFilters = gender !== "" || favoriteOnly;
  const favoriteCount = performers.filter((p) => p.favorite).length;

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
          {loading ? "..." : `${total} total`}
        </span>
      </div>

      {/* Stats strip */}
      {!loading && total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="surface-stat px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1 text-text-disabled">
              <Users className="h-3.5 w-3.5" />
              <span className="text-kicker" style={{ color: "inherit" }}>Performers</span>
            </div>
            <div className="text-lg font-semibold text-text-primary leading-tight">
              {total}
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
              <Film className="h-3.5 w-3.5" />
              <span className="text-kicker" style={{ color: "inherit" }}>Showing</span>
            </div>
            <div className="text-lg font-semibold text-text-primary leading-tight">
              {performers.length}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="space-y-0">
        <div className="surface-well flex items-center gap-2 px-3 py-2">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled pointer-events-none" />
            <input
              type="text"
              placeholder="Search performers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                "w-full bg-transparent pl-7 pr-3 py-1.5 text-[0.78rem] text-text-primary",
                "placeholder:text-text-disabled",
                "focus:outline-none",
                "transition-colors duration-fast"
              )}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-muted"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Active filter chips */}
          {hasFilters && (
            <div className="hidden sm:flex items-center gap-1.5 border-l border-border-subtle pl-2">
              {gender && (
                <span className="inline-flex items-center gap-1 pill-accent px-2 py-0.5 text-[0.68rem] whitespace-nowrap">
                  <span className="text-accent-400/70">Gender:</span>
                  <span className="text-accent-200">{gender}</span>
                  <button
                    onClick={() => setGender("")}
                    className="ml-0.5 text-accent-400/50 hover:text-accent-200 transition-colors duration-fast"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              )}
              {favoriteOnly && (
                <span className="inline-flex items-center gap-1 pill-accent px-2 py-0.5 text-[0.68rem] whitespace-nowrap">
                  <Star className="h-2.5 w-2.5 text-accent-400 fill-current" />
                  <span className="text-accent-200">Favorites</span>
                  <button
                    onClick={() => setFavoriteOnly(false)}
                    className="ml-0.5 text-accent-400/50 hover:text-accent-200 transition-colors duration-fast"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              )}
            </div>
          )}

          <div className="h-5 w-px bg-border-subtle" />

          {/* Sort dropdown */}
          <div className="flex items-center">
            <div className="relative">
              <button
                onClick={() => setSortOpen(!sortOpen)}
                className={cn(
                  "flex items-center gap-1.5 rounded-sm px-2 py-1.5",
                  "text-text-muted text-[0.72rem] hover:text-text-primary hover:bg-surface-2",
                  "transition-colors duration-fast"
                )}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{currentSort?.label}</span>
                <ChevronDown className="h-3 w-3 text-text-disabled" />
              </button>

              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-44 surface-elevated py-1">
                    {sortOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setSortKey(opt.value);
                          setSortDir(defaultSortDir[opt.value]);
                          setSortOpen(false);
                        }}
                        className={cn(
                          "flex items-center gap-2 w-full px-3 py-1.5 text-[0.72rem] text-left transition-colors duration-fast",
                          sortKey === opt.value
                            ? "text-text-accent bg-accent-950"
                            : "text-text-muted hover:text-text-primary hover:bg-surface-3"
                        )}
                      >
                        <Check
                          className={cn("h-3 w-3", sortKey === opt.value ? "opacity-100" : "opacity-0")}
                        />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              title={sortDir === "asc" ? "Ascending" : "Descending"}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-sm",
                "text-text-muted hover:text-text-primary hover:bg-surface-2",
                "transition-colors duration-fast"
              )}
            >
              <ChevronDown className={cn("h-3.5 w-3.5", sortDir === "asc" && "rotate-180")} />
            </button>
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={cn(
              "flex items-center gap-1.5 rounded-sm px-2 py-1.5",
              "text-[0.72rem] transition-colors duration-fast",
              filterOpen
                ? "text-text-accent bg-accent-950"
                : "text-text-muted hover:text-text-primary hover:bg-surface-2"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filters</span>
            {hasFilters && (
              <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-accent-800 text-[0.55rem] font-bold text-accent-200">
                {(gender ? 1 : 0) + (favoriteOnly ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {/* Filter panel */}
        {filterOpen && (
          <div className="surface-well mt-px p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Gender filter */}
              <div>
                <div className="text-kicker mb-2">Gender</div>
                <div className="flex flex-wrap gap-1">
                  {genderOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setGender(opt.value)}
                      className={cn(
                        "tag-chip cursor-pointer transition-colors duration-fast",
                        gender === opt.value
                          ? "tag-chip-accent"
                          : "tag-chip-default hover:tag-chip-accent"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Favorite toggle */}
              <div>
                <div className="text-kicker mb-2">Status</div>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setFavoriteOnly(!favoriteOnly)}
                    className={cn(
                      "tag-chip cursor-pointer transition-colors duration-fast flex items-center gap-1",
                      favoriteOnly
                        ? "tag-chip-accent"
                        : "tag-chip-default hover:tag-chip-accent"
                    )}
                  >
                    <Star className="h-2.5 w-2.5" />
                    Favorites Only
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile filter chips */}
        {hasFilters && (
          <div className="flex sm:hidden items-center gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-hidden">
            {gender && (
              <span className="inline-flex items-center gap-1 pill-accent px-2 py-0.5 text-[0.68rem] whitespace-nowrap">
                <span className="text-accent-400/70">Gender:</span>
                <span className="text-accent-200">{gender}</span>
                <button onClick={() => setGender("")} className="ml-0.5 text-accent-400/50 hover:text-accent-200">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
            {favoriteOnly && (
              <span className="inline-flex items-center gap-1 pill-accent px-2 py-0.5 text-[0.68rem] whitespace-nowrap">
                <Star className="h-2.5 w-2.5 text-accent-400 fill-current" />
                <span className="text-accent-200">Favorites</span>
                <button onClick={() => setFavoriteOnly(false)} className="ml-0.5 text-accent-400/50 hover:text-accent-200">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="surface-well p-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-text-disabled animate-spin" />
        </div>
      ) : performers.length === 0 ? (
        <div className="surface-well p-12 text-center">
          <Users className="h-10 w-10 text-text-disabled mx-auto mb-3" />
          <p className="text-text-muted text-sm">
            {search || hasFilters
              ? "No performers match your filters."
              : "No performers in the library yet."}
          </p>
          {(search || hasFilters) && (
            <button
              onClick={() => {
                setSearch("");
                setGender("");
                setFavoriteOnly(false);
              }}
              className="text-text-accent text-xs mt-2 hover:text-text-accent-bright transition-colors duration-fast"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {performers.map((performer) => (
              <PerformerCard key={performer.id} performer={performer} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded text-xs transition-all duration-fast",
                  page === 0
                    ? "text-text-disabled cursor-not-allowed"
                    : "text-text-muted hover:text-text-accent hover:bg-accent-950"
                )}
              >
                <ChevronLeft className="h-3 w-3" />
                Prev
              </button>
              <span className="text-mono-sm text-text-disabled">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded text-xs transition-all duration-fast",
                  page >= totalPages - 1
                    ? "text-text-disabled cursor-not-allowed"
                    : "text-text-muted hover:text-text-accent hover:bg-accent-950"
                )}
              >
                Next
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </>
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

  const imageUrl = toApiUrl(performer.imagePath);

  return (
    <Link href={`/performers/${performer.id}`}>
      <article className="surface-card group cursor-pointer h-full overflow-hidden">
        {/* Portrait image area — 3:4 aspect ratio */}
        <div className="relative aspect-[3/4] bg-surface-3 overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={performer.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl sm:text-4xl font-semibold font-heading text-text-disabled/60 select-none group-hover:text-text-accent/40 transition-colors duration-fast">
                {initials}
              </span>
            </div>
          )}

          {/* Gradient overlay for text readability */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

          {/* Favorite badge */}
          {performer.favorite && (
            <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm border border-border-accent/50">
              <Star className="h-3 w-3 text-text-accent fill-current" />
            </span>
          )}

          {/* Scene count badge */}
          <div className="absolute bottom-2 left-2">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-sm text-[0.65rem] font-mono text-text-secondary">
              <Film className="h-2.5 w-2.5" />
              {performer.sceneCount}
            </span>
          </div>

          {/* Rating badge */}
          {performer.rating != null && performer.rating > 0 && (
            <div className="absolute bottom-2 right-2">
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-sm text-[0.65rem] font-mono text-text-accent">
                <Star className="h-2.5 w-2.5 fill-current" />
                {performer.rating}
              </span>
            </div>
          )}
        </div>

        {/* Info bar */}
        <div className="px-3 py-2.5">
          <h3 className="text-sm font-medium truncate group-hover:text-text-accent transition-colors duration-fast">
            {performer.name}
          </h3>
          {performer.disambiguation && (
            <p className="text-[0.65rem] text-text-disabled truncate mt-0.5">
              {performer.disambiguation}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}
