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
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@obscura/ui/lib/utils";
import { SceneGrid } from "../../../../components/scene-grid";
import { StudioEdit } from "../../../../components/studio-edit";
import { StashIdChips } from "../../../../components/stash-id-chips";
import {
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
import { use, useEffect } from "react";

interface StudioPageProps {
  params: Promise<{ id: string }>;
}

export default function StudioPage({ params }: StudioPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [studio, setStudio] = useState<StudioDetail | null>(null);
  const [scenes, setScenes] = useState<SceneListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchStudioDetail(id);
      setStudio(data);
      const scenesData = await fetchScenes({ studio: id, limit: 100 });
      setScenes(scenesData.scenes);
      setTotal(scenesData.total);
      setNotFound(false);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

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
      const updated = await fetchStudioDetail(id);
      setStudio(updated);
    } catch { /* ignore */ }
    finally { setUploadingImage(false); }
  }

  async function handleDeleteImage() {
    setUploadingImage(true);
    try {
      await deleteStudioImage(id);
      const updated = await fetchStudioDetail(id);
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
      <div className="relative rounded-lg overflow-hidden bg-surface-3 group">
        <div className="aspect-[21/7]">
          {imageUrl ? (
            <img src={imageUrl} alt={studio.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-3 to-surface-2">
              <Building2 className="h-16 w-16 text-text-disabled/15" />
            </div>
          )}
        </div>
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
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
        {/* Overlaid title */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-white flex items-center gap-2.5 drop-shadow-lg">
              <Building2 className="h-5 w-5 text-accent-400" />
              {studio.name}
            </h1>
            <button onClick={handleToggleFavorite} className={cn("p-1.5 rounded transition-colors", studio.favorite ? "text-red-400 hover:text-red-300" : "text-white/50 hover:text-red-400")}>
              <Heart className={cn("h-4 w-4", studio.favorite && "fill-current")} />
            </button>
          </div>
        </div>
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

        <span className="flex items-center gap-1.5 text-sm text-text-muted"><Film className="h-3.5 w-3.5" /> {total} scene{total !== 1 ? "s" : ""}</span>

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

      <div className="separator" />

      <section>
        <h4 className="text-kicker mb-3">Scenes</h4>
        <SceneGrid scenes={scenes} viewMode="grid" loading={false} />
      </section>
    </div>
  );
}
