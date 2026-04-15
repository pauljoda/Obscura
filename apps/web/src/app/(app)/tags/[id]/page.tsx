"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Tag,
  Loader2,
  Film,
  Clock,
  Pencil,
  Trash2,
  Star,
  Heart,
  Upload,
  X,
  Images,
  Music,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@obscura/ui/lib/utils";
import type { AudioLibraryListItemDto, GalleryListItemDto, SceneFolderListItemDto } from "@obscura/contracts";
import { VideoGrid } from "../../../../components/video-grid";
import { GalleryGrid } from "../../../../components/gallery-grid";
import { AudioLibraryAppearanceGrid } from "../../../../components/audio/audio-library-appearance-grid";
import { SeriesCard } from "../../../../components/series/series-card";
import { TagEdit } from "../../../../components/tag-edit";
import { StashIdChips } from "../../../../components/stash-id-chips";
import { NsfwChip, NsfwTagLabel } from "../../../../components/nsfw/nsfw-gate";
import { useNsfw } from "../../../../components/nsfw/nsfw-context";
import {
  fetchScenes,
  fetchGalleries,
  fetchAudioLibraries,
  fetchSceneFolders,
  fetchTags,
  fetchTagDetail,
  deleteTag,
  toggleTagFavorite,
  setTagRating,
  uploadTagImage,
  deleteTagImage,
  toApiUrl,
  type SceneListItem,
  type TagDetail,
} from "../../../../lib/api";
import { use } from "react";
import { useTerms, formatVideoCount } from "../../../../lib/terminology";
import { BackLink } from "../../../../components/shared/back-link";
import { useCurrentPath } from "../../../../hooks/use-current-path";

interface TagPageProps {
  params: Promise<{ id: string }>;
}

export default function TagPage({ params }: TagPageProps) {
  const terms = useTerms();
  const { mode: nsfwMode } = useNsfw();
  const currentPath = useCurrentPath();
  const { id } = use(params);
  const tagName = decodeURIComponent(id);
  const router = useRouter();

  const [tagDetail, setTagDetail] = useState<TagDetail | null>(null);
  const [scenes, setScenes] = useState<SceneListItem[]>([]);
  const [totalScenes, setTotalScenes] = useState(0);
  const [galleries, setGalleries] = useState<GalleryListItemDto[]>([]);
  const [totalGalleries, setTotalGalleries] = useState(0);
  const [audioLibraries, setAudioLibraries] = useState<AudioLibraryListItemDto[]>([]);
  const [totalAudioLibraries, setTotalAudioLibraries] = useState(0);
  const [folders, setFolders] = useState<SceneFolderListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [scenesRes, galleriesRes, audioRes, tagsRes, foldersRes] = await Promise.all([
        fetchScenes({ tag: [tagName], limit: 100, nsfw: nsfwMode }),
        fetchGalleries({
          tag: [tagName],
          root: "all",
          limit: 100,
          nsfw: nsfwMode,
        }),
        fetchAudioLibraries({
          tag: [tagName],
          root: "all",
          limit: 100,
          nsfw: nsfwMode,
        }),
        fetchTags({ nsfw: nsfwMode }),
        fetchSceneFolders({ tag: tagName, nsfw: nsfwMode, limit: 50 }).catch(() => ({ items: [] })),
      ]);
      setScenes(scenesRes.scenes);
      setTotalScenes(scenesRes.total);
      setGalleries(galleriesRes.galleries);
      setTotalGalleries(galleriesRes.total);
      setAudioLibraries(audioRes.items);
      setTotalAudioLibraries(audioRes.total);
      setFolders(foldersRes.items);

      const match = tagsRes.tags.find((t) => t.name.toLowerCase() === tagName.toLowerCase());
      if (match) {
        const detail = await fetchTagDetail(match.id, { nsfw: nsfwMode });
        setTagDetail(detail);
      } else {
        setTagDetail(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tagName, nsfwMode]);

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
      const updated = await fetchTagDetail(tagDetail.id, { nsfw: nsfwMode });
      setTagDetail(updated);
    } catch { /* ignore */ }
    finally { setUploadingImage(false); }
  }

  async function handleDeleteImage() {
    if (!tagDetail) return;
    setUploadingImage(true);
    try {
      await deleteTagImage(tagDetail.id);
      const updated = await fetchTagDetail(tagDetail.id, { nsfw: nsfwMode });
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
      <BackLink fallback="/tags" label="Tags" />

      {/* Hero banner image */}
      <div className="relative rounded-lg overflow-hidden group">
        {imageUrl ? (
          <img src={imageUrl} alt={tagName} className="w-full max-h-[280px] object-contain" />
        ) : (
          <div className="aspect-[21/5] flex items-center justify-center bg-surface-3">
            <Tag className="h-14 w-14 text-text-disabled/15" />
          </div>
        )}
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
          {tagDetail ? (
            tagDetail.isNsfw === true && nsfwMode === "off" ? (
              <span className="text-text-secondary text-lg font-medium">
                Hidden in SFW mode
              </span>
            ) : (
              <NsfwTagLabel isNsfw={tagDetail.isNsfw}>{tagDetail.name}</NsfwTagLabel>
            )
          ) : (
            tagName
          )}
        </h1>
        {tagDetail?.isNsfw && <NsfwChip />}
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
            <span className="flex items-center gap-1.5 text-sm text-text-muted">
              <Film className="h-3.5 w-3.5" /> {formatVideoCount(totalScenes)}
            </span>
            <span className="flex items-center gap-1.5 text-sm text-text-muted">
              <Images className="h-3.5 w-3.5" />
              {totalGalleries === 1 ? "1 gallery" : `${totalGalleries} galleries`}
            </span>
            <span className="flex items-center gap-1.5 text-sm text-text-muted">
              <Music className="h-3.5 w-3.5" />
              {totalAudioLibraries === 1
                ? "1 audio library"
                : `${totalAudioLibraries} audio libraries`}
            </span>
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

      {/* Folders associated with this tag */}
      {folders.length > 0 && (
        <section>
          <h4 className="text-kicker mb-3">Folders</h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 mb-5">
            {folders.map((f) => (
              <SeriesCard
                key={f.id}
                folder={f}
                href={`/videos?folder=${f.id}`}
                compact
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h4 className="text-kicker mb-3">Tagged {terms.scenes}</h4>
        {loading ? (
          <div className="surface-well p-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-text-disabled animate-spin" />
          </div>
        ) : totalScenes === 0 ? (
          <div className="surface-well p-12 text-center">
            <Film className="h-10 w-10 text-text-disabled mx-auto mb-3" />
            <p className="text-text-muted text-sm">No {terms.scenes.toLowerCase()} with this tag.</p>
          </div>
        ) : (
          <VideoGrid scenes={scenes} viewMode="grid" loading={false} from={currentPath} />
        )}
      </section>

      <div className="separator" />

      <section>
        <h4 className="text-kicker mb-3">Galleries</h4>
        {loading ? (
          <div className="surface-well p-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-text-disabled animate-spin" />
          </div>
        ) : totalGalleries === 0 ? (
          <div className="surface-well p-12 text-center">
            <Images className="h-10 w-10 text-text-disabled mx-auto mb-3" />
            <p className="text-text-muted text-sm">No galleries with this tag.</p>
          </div>
        ) : (
          <GalleryGrid galleries={galleries} viewMode="grid" loading={false} from={currentPath} />
        )}
      </section>

      <div className="separator" />

      <section>
        <h4 className="text-kicker mb-3">Audio</h4>
        {loading ? (
          <div className="surface-well p-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-text-disabled animate-spin" />
          </div>
        ) : (
          <AudioLibraryAppearanceGrid
            libraries={audioLibraries}
            emptyMessage="No audio libraries with this tag."
          />
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
