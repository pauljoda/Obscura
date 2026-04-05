"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Tag,
  ArrowLeft,
  Loader2,
  Film,
  Hash,
  Clock,
  Pencil,
  Trash2,
  Star,
  Heart,
  Upload,
  X,
  Image as ImageIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@obscura/ui/lib/utils";
import { SceneGrid } from "../../../../components/scene-grid";
import { TagEdit } from "../../../../components/tag-edit";
import { StashIdChips } from "../../../../components/stash-id-chips";
import {
  fetchScenes,
  fetchTags,
  fetchTagDetail,
  deleteTag,
  toggleTagFavorite,
  setTagRating,
  uploadTagImage,
  deleteTagImage,
  toApiUrl,
  type SceneListItem,
  type TagItem,
  type TagDetail,
} from "../../../../lib/api";
import { use } from "react";

interface TagPageProps {
  params: Promise<{ id: string }>;
}

export default function TagPage({ params }: TagPageProps) {
  const { id } = use(params);
  const tagName = decodeURIComponent(id);
  const router = useRouter();

  const [tagDetail, setTagDetail] = useState<TagDetail | null>(null);
  const [scenes, setScenes] = useState<SceneListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [scenesRes, tagsRes] = await Promise.all([
        fetchScenes({ tag: [tagName], limit: 100 }),
        fetchTags(),
      ]);
      setScenes(scenesRes.scenes);
      setTotal(scenesRes.total);

      // Resolve tag name to UUID, then fetch full detail
      const match = tagsRes.tags.find((t) => t.name.toLowerCase() === tagName.toLowerCase());
      if (match) {
        const detail = await fetchTagDetail(match.id);
        setTagDetail(detail);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tagName]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleToggleFavorite() {
    if (!tagDetail) return;
    try {
      const result = await toggleTagFavorite(tagDetail.id, !tagDetail.favorite);
      setTagDetail((c) => c ? { ...c, favorite: result.favorite } : c);
    } catch { /* ignore */ }
  }

  async function handleSetRating(rating: number) {
    if (!tagDetail) return;
    const next = tagDetail.rating === rating ? null : rating;
    const prev = tagDetail.rating;
    setTagDetail((c) => c ? { ...c, rating: next } : c);
    try { await setTagRating(tagDetail.id, next); }
    catch { setTagDetail((c) => c ? { ...c, rating: prev } : c); }
  }

  async function handleDelete() {
    if (!tagDetail) return;
    if (!confirm("Delete this tag? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteTag(tagDetail.id);
      router.push("/tags");
    } catch { setDeleting(false); }
  }

  async function handleImageUpload(file: File) {
    if (!tagDetail) return;
    setUploadingImage(true);
    try {
      await uploadTagImage(tagDetail.id, file);
      const updated = await fetchTagDetail(tagDetail.id);
      setTagDetail(updated);
    } catch { /* ignore */ }
    finally { setUploadingImage(false); }
  }

  async function handleDeleteImage() {
    if (!tagDetail) return;
    setUploadingImage(true);
    try {
      await deleteTagImage(tagDetail.id);
      const updated = await fetchTagDetail(tagDetail.id);
      setTagDetail(updated);
    } catch { /* ignore */ }
    finally { setUploadingImage(false); }
  }

  const totalDuration = scenes.reduce((sum, s) => sum + (s.duration ?? 0), 0);
  const durationFormatted = formatDuration(totalDuration);

  if (editing && tagDetail) {
    return (
      <TagEdit
        id={tagDetail.id}
        onSaved={() => { setEditing(false); loadData(); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const imageUrl = tagDetail?.imagePath ? toApiUrl(tagDetail.imagePath) : tagDetail?.imageUrl;

  return (
    <div className="space-y-5">
      <Link href="/tags" className="inline-flex items-center gap-1.5 surface-well px-2.5 py-1 text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast">
        <ArrowLeft className="h-3 w-3" /> Tags
      </Link>

      {/* Hero banner image */}
      <div className="relative rounded-lg overflow-hidden group">
        <div className={imageUrl ? "aspect-[21/9] sm:aspect-[21/7]" : "aspect-[21/5]"}>
          {imageUrl ? (
            <img src={imageUrl} alt={tagName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface-3">
              <Tag className="h-14 w-14 text-text-disabled/15" />
            </div>
          )}
        </div>
        {/* Image actions (hover) */}
        {tagDetail && (
          <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => imageInputRef.current?.click()} disabled={uploadingImage} className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm transition-colors">
              {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            </button>
            {imageUrl && (
              <button onClick={handleDeleteImage} disabled={uploadingImage} className="p-2 rounded-full bg-black/50 text-white hover:bg-red-500/70 backdrop-blur-sm transition-colors">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }} />
      </div>

      {/* Title + favorite (below banner, not overlaid) */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="flex items-center gap-2.5">
          <Tag className="h-5 w-5 text-text-accent flex-shrink-0" />
          {tagName}
        </h1>
        {tagDetail && (
          <button onClick={handleToggleFavorite} className={cn("p-1.5 rounded transition-colors", tagDetail.favorite ? "text-red-400 hover:text-red-300" : "text-text-disabled hover:text-red-400")}>
            <Heart className={cn("h-4 w-4", tagDetail.favorite && "fill-current")} />
          </button>
        )}
      </div>

      {/* Actions + metadata row */}
      <div className="flex items-center gap-4 flex-wrap">
        {tagDetail && (
          <div className="flex items-center gap-1">
            {[20, 40, 60, 80, 100].map((v) => (
              <button key={v} onClick={() => handleSetRating(v)} className="p-0.5 transition-colors">
                <Star className={cn("h-4 w-4", tagDetail.rating != null && tagDetail.rating >= v ? "text-accent-500 fill-accent-500" : "text-text-disabled hover:text-accent-500/50")} />
              </button>
            ))}
          </div>
        )}

        <div className="h-4 w-px bg-border-subtle" />

        {!loading && (
          <>
            <span className="flex items-center gap-1.5 text-sm text-text-muted"><Film className="h-3.5 w-3.5" /> {total} scene{total !== 1 ? "s" : ""}</span>
            {totalDuration > 0 && (
              <>
                <div className="h-4 w-px bg-border-subtle" />
                <span className="flex items-center gap-1.5 text-sm text-text-muted"><Clock className="h-3.5 w-3.5" /> {durationFormatted}</span>
              </>
            )}
          </>
        )}

        <div className="flex-1" />

        {tagDetail && (
          <>
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[0.68rem] text-text-muted hover:text-text-accent border border-border-subtle hover:border-border-accent transition-all duration-fast">
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[0.68rem] text-text-muted hover:text-status-error border border-border-subtle hover:border-status-error/50 transition-all duration-fast">
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Delete
            </button>
          </>
        )}
      </div>

      {/* Description, aliases, stash IDs */}
      {(tagDetail?.description || tagDetail?.aliases) && (
        <div className="space-y-1">
          {tagDetail.description && <p className="text-[0.82rem] text-text-muted max-w-prose">{tagDetail.description}</p>}
          {tagDetail.aliases && <p className="text-[0.72rem] text-text-disabled">Aliases: {tagDetail.aliases}</p>}
        </div>
      )}

      {tagDetail && <StashIdChips entityType="tag" entityId={tagDetail.id} compact />}

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
