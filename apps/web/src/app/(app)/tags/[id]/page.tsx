"use client";

import { useEffect, useState } from "react";
import {
  Tag,
  ArrowLeft,
  Loader2,
  Film,
  Hash,
  Clock,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { SceneGrid } from "../../../../components/scene-grid";
import { TagEdit } from "../../../../components/tag-edit";
import { StashIdChips } from "../../../../components/stash-id-chips";
import {
  fetchScenes,
  fetchTags,
  type SceneListItem,
  type TagItem,
} from "../../../../lib/api";
import { use } from "react";

interface TagPageProps {
  params: Promise<{ id: string }>;
}

export default function TagPage({ params }: TagPageProps) {
  const { id } = use(params);
  const tagName = decodeURIComponent(id);

  const [tagItem, setTagItem] = useState<TagItem | null>(null);
  const [scenes, setScenes] = useState<SceneListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  function loadData() {
    setLoading(true);
    Promise.all([
      fetchScenes({ tag: [tagName], limit: 100 }),
      fetchTags(),
    ])
      .then(([scenesRes, tagsRes]) => {
        setScenes(scenesRes.scenes);
        setTotal(scenesRes.total);
        // Resolve tag name to tag item (for UUID)
        const match = tagsRes.tags.find(
          (t) => t.name.toLowerCase() === tagName.toLowerCase()
        );
        setTagItem(match ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, [tagName]);

  // Compute stats from loaded scenes
  const totalDuration = scenes.reduce((sum, s) => sum + (s.duration ?? 0), 0);
  const durationFormatted = formatDuration(totalDuration);

  if (editing && tagItem) {
    return (
      <TagEdit
        id={tagItem.id}
        onSaved={() => { setEditing(false); loadData(); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Back link */}
      <Link
        href="/tags"
        className="inline-flex items-center gap-1.5 surface-well px-2.5 py-1 text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast"
      >
        <ArrowLeft className="h-3 w-3" />
        Tags
      </Link>

      {/* Header card */}
      <div className="surface-card-sharp p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="flex items-center gap-2.5">
                <Tag className="h-5 w-5 text-text-accent flex-shrink-0" />
                {tagName}
              </h1>
              {tagItem && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[0.68rem] text-text-muted hover:text-text-accent border border-border-subtle hover:border-border-accent transition-all duration-fast"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              )}
            </div>
            <p className="text-text-muted text-[0.78rem] mt-1">
              Scenes tagged with this label
            </p>

            {/* Inline metadata row */}
            {!loading && (
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-text-muted text-sm">
                  <Film className="h-4 w-4" />
                  <span className="text-mono-sm">{total} scene{total !== 1 ? "s" : ""}</span>
                </div>
                {totalDuration > 0 && (
                  <div className="flex items-center gap-1.5 text-text-muted text-sm">
                    <Clock className="h-4 w-4" />
                    <span className="text-mono-sm">{durationFormatted}</span>
                  </div>
                )}
              </div>
            )}

            {/* StashBox IDs */}
            {tagItem && (
              <div className="mt-2">
                <StashIdChips entityType="tag" entityId={tagItem.id} compact />
              </div>
            )}
          </div>

          {/* Tag chip accent */}
          {!loading && (
            <span className="tag-chip tag-chip-accent flex-shrink-0 mt-1">
              <Hash className="h-3 w-3 mr-1" />
              {total}
            </span>
          )}
        </div>
      </div>

      {/* Stats strip */}
      {!loading && total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="surface-stat px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1 text-text-disabled">
              <Film className="h-3.5 w-3.5" />
              <span className="text-kicker" style={{ color: "inherit" }}>Scenes</span>
            </div>
            <div className="text-lg font-semibold text-text-primary leading-tight">
              {total}
            </div>
          </div>
          <div className="surface-stat px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1 text-text-disabled">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-kicker" style={{ color: "inherit" }}>Duration</span>
            </div>
            <div className="text-lg font-semibold text-text-primary leading-tight">
              {totalDuration > 0 ? durationFormatted : "—"}
            </div>
          </div>
          <div className="surface-stat-accent px-3 py-2.5 hidden sm:block">
            <div className="flex items-center gap-1.5 mb-1 text-text-accent">
              <Tag className="h-3.5 w-3.5" />
              <span className="text-kicker" style={{ color: "inherit" }}>Tag</span>
            </div>
            <div className="text-lg font-semibold text-text-accent leading-tight truncate">
              {tagName}
            </div>
          </div>
        </div>
      )}

      <div className="separator" />

      {/* Scene grid */}
      <section>
        <h4 className="text-kicker mb-3">Tagged Scenes</h4>
        {loading ? (
          <div className="surface-well p-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-text-disabled animate-spin" />
          </div>
        ) : total === 0 ? (
          <div className="surface-well p-12 text-center">
            <Film className="h-10 w-10 text-text-disabled mx-auto mb-3" />
            <p className="text-text-muted text-sm">No scenes with this tag.</p>
          </div>
        ) : (
          <SceneGrid scenes={scenes} viewMode="grid" loading={false} />
        )}
      </section>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
