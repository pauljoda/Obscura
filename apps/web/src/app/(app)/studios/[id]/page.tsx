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
  const initials = studio.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-5">
      <Link href="/studios" className="inline-flex items-center gap-1.5 surface-well px-2.5 py-1 text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast">
        <ArrowLeft className="h-3 w-3" /> Studios
      </Link>

      {/* Hero */}
      <div className="flex items-start gap-5">
        {/* Image */}
        <div className="flex-shrink-0 relative group">
          <div className="h-24 w-24 rounded-xl overflow-hidden bg-surface-3">
            {imageUrl ? (
              <img src={imageUrl} alt={studio.name} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-semibold font-heading text-text-muted">
                {initials}
              </div>
            )}
          </div>
          <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-xl">
            <button onClick={() => imageInputRef.current?.click()} disabled={uploadingImage} className="p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors">
              {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            </button>
            {imageUrl && (
              <button onClick={handleDeleteImage} disabled={uploadingImage} className="p-1.5 rounded-full bg-black/60 text-white hover:bg-red-500/80 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="flex items-center gap-2.5">
              <Building2 className="h-5 w-5 text-text-accent" />
              {studio.name}
            </h1>
            <button onClick={handleToggleFavorite} className={cn("p-1.5 rounded transition-colors", studio.favorite ? "text-red-400 hover:text-red-300" : "text-text-disabled hover:text-red-400")}>
              <Heart className={cn("h-4 w-4", studio.favorite && "fill-current")} />
            </button>
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[0.68rem] text-text-muted hover:text-text-accent border border-border-subtle hover:border-border-accent transition-all duration-fast">
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[0.68rem] text-text-muted hover:text-status-error border border-border-subtle hover:border-status-error/50 transition-all duration-fast">
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Delete
            </button>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-1 mt-2">
            {[20, 40, 60, 80, 100].map((v) => (
              <button key={v} onClick={() => handleSetRating(v)} className="p-0.5 transition-colors">
                <Star className={cn("h-4 w-4", studio.rating != null && studio.rating >= v ? "text-accent-500 fill-accent-500" : "text-text-disabled hover:text-accent-500/50")} />
              </button>
            ))}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-4 mt-2 flex-wrap text-sm text-text-muted">
            <span className="flex items-center gap-1.5"><Film className="h-3.5 w-3.5" /> {total} scene{total !== 1 ? "s" : ""}</span>
            {studio.url && (
              <a href={studio.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-text-accent transition-colors">
                <Globe className="h-3.5 w-3.5" /> {studio.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            )}
          </div>

          {/* Description */}
          {studio.description && (
            <p className="text-[0.78rem] text-text-muted mt-2 max-w-prose">{studio.description}</p>
          )}

          {/* Aliases */}
          {studio.aliases && (
            <div className="text-[0.72rem] text-text-disabled mt-1">
              Aliases: {studio.aliases}
            </div>
          )}

          {/* StashBox IDs */}
          <div className="mt-2">
            <StashIdChips entityType="studio" entityId={id} compact />
          </div>
        </div>
      </div>

      <div className="separator" />

      <section>
        <h4 className="text-kicker mb-3">Scenes</h4>
        <SceneGrid scenes={scenes} viewMode="grid" loading={false} />
      </section>
    </div>
  );
}
