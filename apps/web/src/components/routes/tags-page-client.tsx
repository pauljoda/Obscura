"use client";

import { useState, useMemo } from "react";
import {
  Tag,
  Search,
  Hash,
  Film,
  TrendingUp,
  ArrowUpDown,
  ChevronDown,
  Check,
  X,
  LayoutGrid,
  List,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@obscura/ui/lib/utils";
import type { TagItem } from "../../lib/api";

type SortKey = "scenes" | "name" | "recent";
type SortDir = "asc" | "desc";
type ViewMode = "grid" | "cloud";

const defaultSortDir: Record<SortKey, SortDir> = {
  scenes: "desc",
  name: "asc",
  recent: "desc",
};

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "scenes", label: "Scene Count" },
  { value: "name", label: "Name A-Z" },
];

const gradientClasses = [
  "gradient-thumb-1",
  "gradient-thumb-2",
  "gradient-thumb-3",
  "gradient-thumb-4",
  "gradient-thumb-5",
  "gradient-thumb-6",
  "gradient-thumb-7",
  "gradient-thumb-8",
];

interface TagsPageClientProps {
  initialTags: TagItem[];
}

export function TagsPageClient({ initialTags }: TagsPageClientProps) {
  const [tags] = useState(initialTags);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("scenes");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortOpen, setSortOpen] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...tags];
    copy.sort((a, b) => {
      if (sortKey === "name") {
        const cmp = a.name.localeCompare(b.name);
        return sortDir === "asc" ? cmp : -cmp;
      }
      const cmp = a.sceneCount - b.sceneCount;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [tags, sortKey, sortDir]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const term = search.toLowerCase();
    return sorted.filter((t) => t.name.toLowerCase().includes(term));
  }, [sorted, search]);

  const maxCount = tags.length > 0 ? Math.max(...tags.map((t) => t.sceneCount)) : 1;
  const totalScenes = tags.reduce((sum, t) => sum + t.sceneCount, 0);
  const avgPerTag = tags.length > 0 ? Math.round(totalScenes / tags.length) : 0;
  const topTag = tags.length > 0 ? [...tags].sort((a, b) => b.sceneCount - a.sceneCount)[0] : null;

  const currentSort = sortOptions.find((s) => s.value === sortKey);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5">
            <Tag className="h-5 w-5 text-text-accent" />
            Tags
          </h1>
          <p className="text-text-muted text-[0.78rem] mt-1">
            Browse and filter by tag
          </p>
        </div>
        <span className="text-mono-sm text-text-disabled mt-1">
          {tags.length} tags
        </span>
      </div>

      {/* Stats strip */}
      {tags.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard icon={<Tag className="h-3.5 w-3.5" />} label="Total Tags" value={String(tags.length)} />
          <StatCard icon={<Film className="h-3.5 w-3.5" />} label="Tagged Scenes" value={String(totalScenes)} />
          <StatCard icon={<Hash className="h-3.5 w-3.5" />} label="Avg / Tag" value={String(avgPerTag)} />
          <StatCard icon={<TrendingUp className="h-3.5 w-3.5" />} label="Top Tag" value={topTag ? topTag.name : "—"} accent />
        </div>
      )}

      {/* Toolbar */}
      {tags.length > 0 && (
        <div className="surface-well flex items-center gap-2 px-3 py-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled pointer-events-none" />
            <input
              type="text"
              placeholder="Search tags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                "w-full bg-transparent pl-7 pr-3 py-1.5 text-[0.78rem] text-text-primary",
                "placeholder:text-text-disabled focus:outline-none transition-colors duration-fast",
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

          {search && (
            <span className="text-mono-sm text-text-disabled whitespace-nowrap">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </span>
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
                  "transition-colors duration-fast",
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
                            : "text-text-muted hover:text-text-primary hover:bg-surface-3",
                        )}
                      >
                        <Check className={cn("h-3 w-3", sortKey === opt.value ? "opacity-100" : "opacity-0")} />
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
                "transition-colors duration-fast",
              )}
            >
              <ChevronDown className={cn("h-3.5 w-3.5", sortDir === "asc" && "rotate-180")} />
            </button>
          </div>

          <div className="h-5 w-px bg-border-subtle" />

          {/* View mode toggle */}
          <div className="flex items-center">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-sm transition-colors duration-fast",
                viewMode === "grid"
                  ? "text-text-accent bg-accent-950"
                  : "text-text-muted hover:text-text-primary hover:bg-surface-2",
              )}
              title="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("cloud")}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-sm transition-colors duration-fast",
                viewMode === "cloud"
                  ? "text-text-accent bg-accent-950"
                  : "text-text-muted hover:text-text-primary hover:bg-surface-2",
              )}
              title="Cloud view"
            >
              <Hash className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="surface-well p-12 text-center">
          <Tag className="h-10 w-10 text-text-disabled mx-auto mb-3" />
          <p className="text-text-muted text-sm">
            {search ? "No tags match your search." : "No tags in the library yet."}
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
      ) : viewMode === "cloud" ? (
        <div className="surface-panel p-6">
          <h4 className="text-kicker mb-4">
            {search ? `Results (${filtered.length})` : "Tag Cloud"}
          </h4>
          <div className="flex flex-wrap gap-2 justify-center">
            {filtered.map((tag) => {
              const intensity = tag.sceneCount / maxCount;
              return (
                <Link
                  key={tag.id}
                  href={`/tags/${encodeURIComponent(tag.name)}`}
                  className={cn(
                    "border px-3 py-1.5 transition-all duration-fast",
                    "hover:border-border-accent hover:bg-accent-950 hover:text-text-accent hover:shadow-[0_0_12px_rgba(199,155,92,0.15)]",
                    intensity > 0.6
                      ? "border-border-accent text-accent-400 text-base font-medium bg-accent-950/30"
                      : intensity > 0.3
                        ? "border-border-default text-text-secondary text-sm"
                        : "border-border-subtle text-text-muted text-xs",
                  )}
                >
                  {tag.name}
                  <span className="ml-1.5 text-text-disabled text-xs">{tag.sceneCount}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {filtered.map((tag, i) => (
            <TagCard key={tag.id} tag={tag} maxCount={maxCount} gradientClass={gradientClasses[i % 8]} />
          ))}
        </div>
      )}
    </div>
  );
}

function TagCard({ tag, maxCount, gradientClass }: { tag: TagItem; maxCount: number; gradientClass: string }) {
  const intensity = tag.sceneCount / maxCount;

  return (
    <Link href={`/tags/${encodeURIComponent(tag.name)}`}>
      <article className="surface-card group cursor-pointer h-full overflow-hidden">
        <div className={cn("relative h-20 overflow-hidden", gradientClass)}>
          <div className="absolute inset-0 flex items-center justify-center">
            <Tag className="h-10 w-10 text-white/[0.06]" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-surface-1">
            <div
              className="h-full bg-accent-500/60 transition-all duration-moderate"
              style={{ width: `${Math.max(intensity * 100, 4)}%` }}
            />
          </div>
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-sm text-[0.65rem] font-mono text-text-secondary">
              <Film className="h-2.5 w-2.5" />
              {tag.sceneCount}
            </span>
          </div>
        </div>
        <div className="px-3 py-2.5">
          <h3 className="text-sm font-medium truncate group-hover:text-text-accent transition-colors duration-fast">
            {tag.name}
          </h3>
          <p className="text-[0.65rem] text-text-disabled mt-0.5">
            {tag.sceneCount} scene{tag.sceneCount !== 1 ? "s" : ""}
          </p>
        </div>
      </article>
    </Link>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={accent ? "surface-stat-accent px-3 py-2.5" : "surface-stat px-3 py-2.5"}>
      <div className={`flex items-center gap-1.5 mb-1 ${accent ? "text-text-accent" : "text-text-disabled"}`}>
        {icon}
        <span className="text-kicker" style={{ color: "inherit" }}>{label}</span>
      </div>
      <div className={accent ? "text-lg font-semibold text-text-accent leading-tight truncate" : "text-lg font-semibold text-text-primary leading-tight truncate"}>
        {value}
      </div>
    </div>
  );
}
