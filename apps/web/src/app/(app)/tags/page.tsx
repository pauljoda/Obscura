"use client";

import { useEffect, useState, useMemo } from "react";
import { Tag, Search, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@obscura/ui";
import { fetchTags, type TagItem } from "../../../lib/api";

export default function TagsPage() {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchTags()
      .then((r) => setTags(r.tags))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(
    () => [...tags].sort((a, b) => b.sceneCount - a.sceneCount),
    [tags]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const term = search.toLowerCase();
    return sorted.filter((t) => t.name.toLowerCase().includes(term));
  }, [sorted, search]);

  const maxCount = sorted[0]?.sceneCount ?? 1;
  const totalScenes = tags.reduce((sum, t) => sum + t.sceneCount, 0);

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
          {loading ? "…" : `${tags.length} tags`}
        </span>
      </div>

      {/* Stats strip */}
      {!loading && tags.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="surface-stat px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1 text-text-disabled">
              <Tag className="h-3.5 w-3.5" />
              <span className="text-kicker" style={{ color: "inherit" }}>Total Tags</span>
            </div>
            <div className="text-lg font-semibold text-text-primary leading-tight">
              {tags.length}
            </div>
          </div>
          <div className="surface-stat px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1 text-text-disabled">
              <Tag className="h-3.5 w-3.5" />
              <span className="text-kicker" style={{ color: "inherit" }}>Tagged Scenes</span>
            </div>
            <div className="text-lg font-semibold text-text-primary leading-tight">
              {totalScenes}
            </div>
          </div>
        </div>
      )}

      {/* Search toolbar */}
      {!loading && tags.length > 0 && (
        <div className="surface-well flex items-center gap-2 p-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled pointer-events-none" />
            <input
              type="text"
              placeholder="Search tags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="control-input w-full pl-8 pr-3 py-1.5 text-sm"
            />
          </div>
          {search && (
            <span className="text-mono-sm text-text-disabled">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="surface-well p-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-text-disabled animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
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
      ) : (
        <>
          {/* Tag cloud */}
          {!search && (
            <div className="surface-panel p-6">
              <h4 className="text-kicker mb-4">Tag Cloud</h4>
              <div className="flex flex-wrap gap-2 justify-center">
                {sorted.slice(0, 40).map((tag) => {
                  const intensity = tag.sceneCount / maxCount;
                  return (
                    <Link
                      key={tag.id}
                      href={`/tags/${encodeURIComponent(tag.name)}`}
                      className={cn(
                        "rounded-md border px-3 py-1.5 transition-all duration-fast",
                        "hover:border-border-accent hover:bg-accent-950 hover:text-text-accent",
                        intensity > 0.6
                          ? "border-border-accent text-accent-400 text-base font-medium"
                          : intensity > 0.3
                            ? "border-border-default text-text-secondary text-sm"
                            : "border-border-subtle text-text-muted text-xs"
                      )}
                    >
                      {tag.name}
                      <span className="ml-1.5 text-text-disabled text-xs">
                        {tag.sceneCount}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tag list */}
          <section>
            <h4 className="text-kicker mb-3">
              {search ? `Results (${filtered.length})` : "All Tags"}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {filtered.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/tags/${encodeURIComponent(tag.name)}`}
                  className="surface-card flex items-center justify-between p-3 group"
                >
                  <span className="text-sm group-hover:text-text-accent transition-colors duration-fast truncate">
                    {tag.name}
                  </span>
                  <span className="text-mono-sm text-text-disabled flex-shrink-0 ml-2">
                    {tag.sceneCount}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
