"use client";

import { useCallback, useState, useRef } from "react";
import {
  Building2,
  ArrowLeft,
  Loader2,
  Globe,
  Pencil,
  Trash2,
  Star,
  Heart,
  Upload,
  X,
  Image as ImageIcon,
  Film,
  Images,
  Music,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@obscura/ui/lib/utils";
import { SceneGrid } from "../../../../components/scene-grid";
import { StudioEdit } from "../../../../components/studio-edit";
import { StashIdChips } from "../../../../components/stash-id-chips";
import { NsfwChip } from "../../../../components/nsfw/nsfw-gate";
import { useNsfw } from "../../../../components/nsfw/nsfw-context";
import type { AudioLibraryListItemDto, GalleryListItemDto } from "@obscura/contracts";
import {
  fetchAudioLibraries,
  fetchGalleries,
  fetchScenes,
  fetchStudioDetail,
  deleteStudio,
  toggleStudioFavorite,
  setStudioRating,
  uploadStudioImage,
  deleteStudioImage,
  toApiUrl,
  type SceneListItem,
  type StudioDetail,
} from "../../../../lib/api";
import { GalleryGrid } from "../../../../components/gallery-grid";
import { AudioLibraryAppearanceGrid } from "../../../../components/audio/audio-library-appearance-grid";
import { use, useEffect } from "react";
import { useTerms, formatVideoCount } from "../../../../lib/terminology";

interface StudioPageProps {
  params: Promise<{ id: string }>;
}

export default function StudioPage({ params }: StudioPageProps) {
  const terms = useTerms();
  const { mode: nsfwMode } = useNsfw();
  const { id } = use(params);
  const router = useRouter();

  const [studio, setStudio] = useState<StudioDetail | null>(null);
  const [scenes, setScenes] = useState<SceneListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [galleries, setGalleries] = useState<GalleryListItemDto[]>([]);
  const [totalGalleries, setTotalGalleries] = useState(0);
  const [audioLibraries, setAudioLibraries] = useState<AudioLibraryListItemDto[]>([]);
  const [totalAudioLibraries, setTotalAudioLibraries] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchStudioDetail(id, { nsfw: nsfwMode });
      setStudio(data);
      const [scenesData, galleriesData, audioData] = await Promise.all([
        fetchScenes({ studio: [id], limit: 100, nsfw: nsfwMode }),
        fetchGalleries({ studio: id, root: "all", limit: 100, nsfw: nsfwMode }),
        fetchAudioLibraries({ studio: data.name, root: "all", limit: 100, nsfw: nsfwMode }),
      ]);
      setScenes(scenesData.scenes);
      setTotal(scenesData.total);
      setGalleries(galleriesData.galleries);
      setTotalGalleries(galleriesData.total);
      setAudioLibraries(audioData.items);
      setTotalAudioLibraries(audioData.total);
      setNotFound(false);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id, nsfwMode]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleToggleFavorite() {
    if (!studio) return;
    try {
      const result = await toggleStudioFavorite(id, !studio.favorite);
      setStudio((c) => c ? { ...c, favorite: result.favorite } : c);
    } catch { /* ignore */ }
  }

  async function handleSetRating(rating: number) {
    if (!studio) return;
    const next = studio.rating === rating ? null : rating;
    const prev = studio.rating;
    setStudio((c) => c ? { ...c, rating: next } : c);
    try { await setStudioRating(id, next); }
    catch { setStudio((c) => c ? { ...c, rating: prev } : c); }
  }

  async function handleDelete() {
    if (!confirm("Delete this studio? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteStudio(id);
      router.push("/studios");
    } catch { setDeleting(false); }
  }

  async function handleImageUpload(file: File) {
    setUploadingImage(true);
    try {
      await uploadStudioImage(id, file);
      const updated = await fetchStudioDetail(id, { nsfw: nsfwMode });
      setStudio(updated);
    } catch { /* ignore */ }
    finally { setUploadingImage(false); }
  }

  async function handleDeleteImage() {
    setUploadingImage(true);
    try {
      await deleteStudioImage(id);
      const updated = await fetchStudioDetail(id, { nsfw: nsfwMode });
      setStudio(updated);
    } catch { /* ignore */ }
    finally { setUploadingImage(false); }
  }

  if (loading) {
    return (
      <div className="surface-well p-16 flex items-center justify-center">
        <Loader2 className="h-7 w-7 text-text-accent animate-spin" />
      </div>
    );
  }

  if (notFound || !studio) {
    return (
      <div className="space-y-4">
        <Link href="/studios" className="inline-flex items-center gap-1.5 surface-well px-2.5 py-1 text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast">
          <ArrowLeft className="h-3 w-3" /> Studios
        </Link>
        <div className="surface-well p-12 text-center">
          <Building2 className="h-10 w-10 text-text-disabled mx-auto mb-3" />
          <p className="text-text-muted text-sm">Studio not found.</p>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <StudioEdit
        id={id}
        onSaved={() => { setEditing(false); loadData(); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const imageUrl = studio.imagePath ? toApiUrl(studio.imagePath) : studio.imageUrl;

  return (
    <div className="space-y-5">
      <Link href="/studios" className="inline-flex items-center gap-1.5 surface-well px-2.5 py-1 text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast">
        <ArrowLeft className="h-3 w-3" /> Studios
      </Link>

      {/* Hero banner image */}
      <div className="relative rounded-lg overflow-hidden group">
        {imageUrl ? (
          <img src={imageUrl} alt={studio.name} className="w-full max-h-[280px] object-contain" />
        ) : (
          <div className="aspect-[21/5] flex items-center justify-center bg-surface-3">
            <Building2 className="h-16 w-16 text-text-disabled/15" />
          </div>
        )}
        {/* Image actions (hover) */}
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
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }} />
      </div>

      {/* Parent studio link */}
      {studio.parent && (
        <div className="flex items-center gap-1.5 text-[0.72rem] text-text-muted">
          <Building2 className="h-3 w-3" />
          <span>Sub-studio of</span>
          <Link href={`/studios/${studio.parent.id}`} className="text-text-accent hover:underline">
            {studio.parent.name}
          </Link>
        </div>
      )}

      {/* Title + favorite (below banner, not overlaid) */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="flex items-center gap-2.5">
          <Building2 className="h-5 w-5 text-text-accent" />
          {studio.name}
        </h1>
        {studio.isNsfw && <NsfwChip />}
        <button onClick={handleToggleFavorite} className={cn("p-1.5 rounded transition-colors", studio.favorite ? "text-red-400 hover:text-red-300" : "text-text-disabled hover:text-red-400")}>
          <Heart className={cn("h-4 w-4", studio.favorite && "fill-current")} />
        </button>
      </div>

      {/* Actions + metadata row */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Rating */}
        <div className="flex items-center gap-1">
          {[20, 40, 60, 80, 100].map((v) => (
            <button key={v} onClick={() => handleSetRating(v)} className="p-0.5 transition-colors">
              <Star className={cn("h-4 w-4", studio.rating != null && studio.rating >= v ? "text-accent-500 fill-accent-500" : "text-text-disabled hover:text-accent-500/50")} />
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-border-subtle" />

        <span className="flex items-center gap-1.5 text-sm text-text-muted">
          <Film className="h-3.5 w-3.5" /> {formatVideoCount(total)}
        </span>
        <span className="flex items-center gap-1.5 text-sm text-text-muted">
          <Images className="h-3.5 w-3.5" />
          {totalGalleries === 1 ? "1 gallery" : `${totalGalleries} galleries`}
        </span>
        <span className="flex items-center gap-1.5 text-sm text-text-muted">
          <Music className="h-3.5 w-3.5" />
          {totalAudioLibraries === 1 ? "1 audio library" : `${totalAudioLibraries} audio libraries`}
        </span>

        {studio.url && (
          <>
            <div className="h-4 w-px bg-border-subtle" />
            <a href={studio.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-accent transition-colors">
              <Globe className="h-3.5 w-3.5" /> {studio.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          </>
        )}

        <div className="flex-1" />

        <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[0.68rem] text-text-muted hover:text-text-accent border border-border-subtle hover:border-border-accent transition-all duration-fast">
          <Pencil className="h-3 w-3" /> Edit
        </button>
        <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[0.68rem] text-text-muted hover:text-status-error border border-border-subtle hover:border-status-error/50 transition-all duration-fast">
          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Delete
        </button>
      </div>

      {/* Description, aliases, stash IDs */}
      {(studio.description || studio.aliases) && (
        <div className="space-y-1">
          {studio.description && <p className="text-[0.82rem] text-text-muted max-w-prose">{studio.description}</p>}
          {studio.aliases && <p className="text-[0.72rem] text-text-disabled">Aliases: {studio.aliases}</p>}
        </div>
      )}

      <StashIdChips entityType="studio" entityId={id} compact />

      {/* Child studios */}
      {studio.childStudios && studio.childStudios.length > 0 && (
        <>
          <div className="separator" />
          <section>
            <h4 className="text-kicker mb-3">Sub-Studios ({studio.childStudios.length})</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {studio.childStudios.map((child) => {
                const childImg = child.imagePath ? toApiUrl(child.imagePath) : child.imageUrl;
                return (
                  <Link
                    key={child.id}
                    href={`/studios/${child.id}`}
                    className="group surface-well rounded-lg overflow-hidden hover:border-border-accent transition-all duration-fast"
                  >
                    <div className="aspect-video bg-surface-3 flex items-center justify-center overflow-hidden">
                      {childImg ? (
                        <img src={childImg} alt={child.name} className="w-full h-full object-contain" />
                      ) : (
                        <Building2 className="h-8 w-8 text-text-disabled/20" />
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-[0.78rem] font-medium truncate group-hover:text-text-accent transition-colors">{child.name}</p>
                      <p className="text-[0.65rem] text-text-disabled">{formatVideoCount(child.sceneCount)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}

      <div className="separator" />

      <section>
        <h4 className="text-kicker mb-3">{terms.scenes}</h4>
        <SceneGrid scenes={scenes} viewMode="grid" loading={false} />
      </section>

      <div className="separator" />

      <section>
        <h4 className="text-kicker mb-3">Galleries</h4>
        {totalGalleries > 0 ? (
          <GalleryGrid galleries={galleries} viewMode="grid" loading={false} />
        ) : (
          <div className="surface-well p-8 text-center">
            <Images className="mx-auto mb-2 h-8 w-8 text-text-disabled" />
            <p className="text-sm text-text-muted">No galleries are linked to this studio.</p>
          </div>
        )}
      </section>

      <div className="separator" />

      <section>
        <h4 className="text-kicker mb-3">Audio</h4>
        <AudioLibraryAppearanceGrid
          libraries={audioLibraries}
          emptyMessage="No audio libraries are linked to this studio."
        />
      </section>
    </div>
  );
}
