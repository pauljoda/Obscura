"use client";

import { useState, useMemo } from "react";
import {
  Tag,
  Search,
  Film,
  Image,
  ArrowUpDown,
  ChevronDown,
  Check,
  X,
  List,
  Cloud,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@obscura/ui/lib/utils";
import { type TagItem } from "../../lib/api";
import { TagEntityCard } from "../tags/tag-entity-card";
import { tagItemToCardData } from "../tags/tag-card-data";

type SortKey = "scenes" | "name" | "recent";
type SortDir = "asc" | "desc";
type ViewMode = "list" | "cloud";

const defaultSortDir: Record<SortKey, SortDir> = {
  scenes: "desc",
  name: "asc",
  recent: "desc",
};

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "scenes", label: "Usage Count" },
  { value: "name", label: "Name A-Z" },
];

interface TagsPageClientProps {
  initialTags: TagItem[];
}

export function TagsPageClient({ initialTags }: TagsPageClientProps) {
  const [tags] = useState(initialTags);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("scenes");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortOpen, setSortOpen] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...tags];
    copy.sort((a, b) => {
      if (sortKey === "name") {
        const cmp = a.name.localeCompare(b.name);
        return sortDir === "asc" ? cmp : -cmp;
      }
      const cmp = (a.sceneCount + (a.imageCount ?? 0)) - (b.sceneCount + (b.imageCount ?? 0));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [tags, sortKey, sortDir]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const term = search.toLowerCase();
    return sorted.filter((t) => t.name.toLowerCase().includes(term));
  }, [sorted, search]);

  const totalCount = (t: TagItem) => t.sceneCount + (t.imageCount ?? 0);
  const maxCount = tags.length > 0 ? Math.max(...tags.map(totalCount)) : 1;
  const totalScenes = tags.reduce((sum, t) => sum + t.sceneCount, 0);
  const totalImages = tags.reduce((sum, t) => sum + (t.imageCount ?? 0), 0);
  const topTag = tags.length > 0 ? [...tags].sort((a, b) => totalCount(b) - totalCount(a))[0] : null;

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

      {/* Inline stats */}
      {tags.length > 0 && (
        <div className="flex items-center gap-4 text-[0.72rem] text-text-disabled">
          <span className="flex items-center gap-1"><Film className="h-3 w-3" />{totalScenes} scenes</span>
          <span className="flex items-center gap-1"><Image className="h-3 w-3" />{totalImages} images</span>
          {topTag && <span>Top: <span className="text-text-muted">{topTag.name}</span></span>}
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
              onClick={() => setViewMode("list")}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-sm transition-colors duration-fast",
                viewMode === "list"
                  ? "text-text-accent bg-accent-950"
                  : "text-text-muted hover:text-text-primary hover:bg-surface-2",
              )}
              title="List view"
            >
              <List className="h-3.5 w-3.5" />
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
              <Cloud className="h-3.5 w-3.5" />
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
          <div className="flex flex-wrap gap-1.5 justify-center">
            {filtered.map((tag) => {
              return (
                <TagEntityCard
                  key={tag.id}
                  tag={tagItemToCardData(tag)}
                  variant="cloud"
                  maxCount={maxCount}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-0">
          {filtered.map((tag) => (
            <TagEntityCard key={tag.id} tag={tagItemToCardData(tag)} />
          ))}
        </div>
      )}
    </div>
  );
}

