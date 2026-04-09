"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@obscura/ui/lib/utils";
import { fetchTags, type TagItem, updateTag, deleteTag } from "../../lib/api";
import { TagEntityCard } from "../tags/tag-entity-card";
import { tagItemToCardData } from "../tags/tag-card-data";

import { DashboardStatTile } from "../dashboard/dashboard-stat-tile";
import { DASHBOARD_STAT_GRADIENTS } from "../dashboard/dashboard-utils";
import { useSelection } from "../../hooks/use-selection";
import { SelectAllHeader } from "../select-all-header";
import { BulkActionToolbar } from "../bulk-action-toolbar";
import { ConfirmDeleteDialog } from "../confirm-delete-dialog";
import { useTerms } from "../../lib/terminology";
import { tagsVisibleInNsfwMode } from "../nsfw/nsfw-gate";
import { useNsfw } from "../nsfw/nsfw-context";
import type { TagsListPrefs, TagsSortKey, TagsViewMode } from "../../lib/tags-list-prefs";
import {
  defaultTagsListPrefs,
  isDefaultTagsListPrefs,
  writeTagsListPrefsCookie,
  clearTagsListPrefsCookie,
} from "../../lib/tags-list-prefs";

type SortDir = "asc" | "desc";

const defaultSortDir: Record<TagsSortKey, SortDir> = {
  scenes: "desc",
  name: "asc",
};

const sortOptions: { value: TagsSortKey; label: string }[] = [
  { value: "scenes", label: "Usage Count" },
  { value: "name", label: "Name A-Z" },
];

interface TagsPageClientProps {
  initialTags: TagItem[];
  initialListPrefs: TagsListPrefs;
}

export function TagsPageClient({ initialTags, initialListPrefs }: TagsPageClientProps) {
  const terms = useTerms();
  const { mode: nsfwMode } = useNsfw();
  const [tags, setTags] = useState(initialTags);
  const [search, setSearch] = useState(initialListPrefs.search);
  const [sortKey, setSortKey] = useState<TagsSortKey>(initialListPrefs.sortKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialListPrefs.sortDir);
  const [viewMode, setViewMode] = useState<TagsViewMode>(initialListPrefs.viewMode);
  const [sortOpen, setSortOpen] = useState(false);

  const selection = useSelection();
  const [bulkLoading, setBulkLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const skipFirstTagRefetch = useRef(true);

  useEffect(() => {
    if (skipFirstTagRefetch.current) {
      skipFirstTagRefetch.current = false;
      return;
    }
    void fetchTags({ nsfw: nsfwMode })
      .then((r) => setTags(r.tags))
      .catch(() => {});
  }, [nsfwMode]);

  useEffect(() => {
    const prefs: TagsListPrefs = { search, sortKey, sortDir, viewMode };
    if (isDefaultTagsListPrefs(prefs)) {
      clearTagsListPrefsCookie();
    } else {
      writeTagsListPrefsCookie(prefs);
    }
  }, [search, sortKey, sortDir, viewMode]);

  const handleClearFiltersAndSort = useCallback(() => {
    const d = defaultTagsListPrefs();
    setSearch(d.search);
    setSortKey(d.sortKey);
    setSortDir(d.sortDir);
    setViewMode(d.viewMode);
    selection.deselectAll();
  }, [selection]);

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

  const displayedTags = useMemo(
    () => tagsVisibleInNsfwMode(filtered, nsfwMode),
    [filtered, nsfwMode],
  );

  const totalCount = (t: TagItem) => t.sceneCount + (t.imageCount ?? 0);
  const maxCount =
    displayedTags.length > 0
      ? Math.max(...displayedTags.map(totalCount))
      : 1;
  const totalScenes = tags.reduce((sum, t) => sum + t.sceneCount, 0);
  const totalImages = tags.reduce((sum, t) => sum + (t.imageCount ?? 0), 0);
  const tagsSafeForTopTile = tagsVisibleInNsfwMode(tags, nsfwMode);
  const topTag =
    tagsSafeForTopTile.length > 0
      ? [...tagsSafeForTopTile].sort((a, b) => totalCount(b) - totalCount(a))[0]
      : null;

  const currentSort = sortOptions.find((s) => s.value === sortKey);
  const visibleIds = displayedTags.map((t) => t.id);

  async function handleBulkNsfw(isNsfw: boolean) {
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selection.selectedIds).map((id) => updateTag(id, { isNsfw })),
      );
      setTags((prev) =>
        prev.map((t) =>
          selection.selectedIds.has(t.id) ? { ...t, isNsfw } : t,
        ),
      );
      selection.deselectAll();
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkDelete() {
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selection.selectedIds).map((id) => deleteTag(id)),
      );
      setTags((prev) => prev.filter((t) => !selection.selectedIds.has(t.id)));
      selection.deselectAll();
      setDeleteDialogOpen(false);
    } finally {
      setBulkLoading(false);
    }
  }

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
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <DashboardStatTile
            icon={<Film className="h-4 w-4" />}
            label={`Tagged ${terms.scenes}`}
            value={String(totalScenes)}
            gradientClass={DASHBOARD_STAT_GRADIENTS[0]}
          />
          <DashboardStatTile
            icon={<Image className="h-4 w-4" />}
            label="Tagged Images"
            value={String(totalImages)}
            gradientClass={DASHBOARD_STAT_GRADIENTS[1]}
          />
          {topTag && (
            <div className="hidden sm:block">
              <DashboardStatTile
                icon={<Tag className="h-4 w-4" />}
                label="Top Tag"
                value={topTag.name}
                gradientClass={DASHBOARD_STAT_GRADIENTS[2]}
              />
            </div>
          )}
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
              {displayedTags.length} result{displayedTags.length !== 1 ? "s" : ""}
            </span>
          )}

          <div className="h-5 w-px bg-border-subtle" />

          {/* Sort dropdown */}
          <div className="flex items-center">
            <div className="relative">
              <button
                onClick={() => setSortOpen(!sortOpen)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1.5",
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
                "flex h-7 w-7 items-center justify-center ",
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
                "flex h-7 w-7 items-center justify-center transition-colors duration-fast",
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
                "flex h-7 w-7 items-center justify-center transition-colors duration-fast",
                viewMode === "cloud"
                  ? "text-text-accent bg-accent-950"
                  : "text-text-muted hover:text-text-primary hover:bg-surface-2",
              )}
              title="Cloud view"
            >
              <Cloud className="h-3.5 w-3.5" />
            </button>
          </div>

          {!isDefaultTagsListPrefs({ search, sortKey, sortDir, viewMode }) && (
            <button
              type="button"
              onClick={handleClearFiltersAndSort}
              title="Clear search, sort, view, and saved preferences"
              className={cn(
                "flex items-center gap-1 px-2 py-1.5",
                "text-text-muted text-[0.72rem] hover:text-text-primary hover:bg-surface-2",
                "transition-colors duration-fast",
              )}
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
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
      ) : displayedTags.length === 0 ? (
        <div className="surface-well p-12 text-center">
          <Tag className="h-10 w-10 text-text-disabled mx-auto mb-3" />
          <p className="text-text-muted text-sm">
            No tags are visible with the current NSFW setting.
          </p>
        </div>
      ) : viewMode === "list" ? (
        <>
          {displayedTags.length > 0 && (
            <SelectAllHeader
              allSelected={selection.isAllSelected(visibleIds)}
              onToggle={() =>
                selection.isAllSelected(visibleIds)
                  ? selection.deselectAll()
                  : selection.selectAll(visibleIds)
              }
              selectedCount={selection.count}
              totalVisible={displayedTags.length}
            />
          )}
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-0">
            {displayedTags.map((tag) => (
              <TagEntityCard
                key={tag.id}
                tag={tagItemToCardData(tag)}
                selected={selection.isSelected(tag.id)}
                onToggleSelect={selection.toggle}
              />
            ))}
          </div>
        </>
      ) : viewMode === "cloud" ? (
        <div className="surface-panel p-6">
          <div className="flex flex-wrap gap-1.5 justify-center">
            {displayedTags.map((tag) => {
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
      ) : null}

      <BulkActionToolbar
        selectedCount={selection.count}
        onDeselectAll={selection.deselectAll}
        onMarkNsfw={() => void handleBulkNsfw(true)}
        onUnmarkNsfw={() => void handleBulkNsfw(false)}
        onDelete={() => setDeleteDialogOpen(true)}
        loading={bulkLoading}
      />

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        entityType="tag"
        count={selection.count}
        onDeleteFromLibrary={() => void handleBulkDelete()}
        loading={bulkLoading}
      />
    </div>
  );
}

