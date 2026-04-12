"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Star,
  ChevronLeft,
  Pencil,
  Save,
  XCircle,
  CheckCircle2,
  FolderPlus,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { ImageDetailDto } from "@obscura/contracts";
import {
  toApiUrl,
  updateImage,
  fetchImageDetail,
  type TagItem,
  type PerformerItem,
} from "../../lib/api";
import { NsfwBlur, NsfwChip, NsfwEditToggle, NsfwTagLabel, tagsVisibleInNsfwMode } from "../nsfw/nsfw-gate";
import { useNsfw } from "../nsfw/nsfw-context";
import { useTerms } from "../../lib/terminology";
import { isVideoImage } from "../../lib/image-media";
import { AddToCollectionModal } from "../collections/add-to-collection-modal";
import { ChipInput } from "../shared/chip-input";
import { usePlaylistContext } from "../collections/playlist-context";

interface ImageDetailClientProps {
  image: ImageDetailDto;
  availableTags?: TagItem[];
  availablePerformers?: PerformerItem[];
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

export function ImageDetailClient({
  image: initialImage,
  availableTags = [],
  availablePerformers = [],
}: ImageDetailClientProps) {
  const terms = useTerms();
  const { mode: nsfwMode } = useNsfw();
  const playlist = usePlaylistContext();
  const [image, setImage] = useState(initialImage);
  const [zoom, setZoom] = useState(1);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);

  // Edit state
  const [editRating, setEditRating] = useState<number | null>(image.rating);
  const [editOrganized, setEditOrganized] = useState(image.organized);
  const [editIsNsfw, setEditIsNsfw] = useState(image.isNsfw ?? false);
  const [editTags, setEditTags] = useState(image.tags.map((t) => t.name));
  const [editPerformers, setEditPerformers] = useState(image.performers.map((p) => p.name));

  const fullUrl = toApiUrl(image.fullPath);
  const imageTagsVisible = tagsVisibleInNsfwMode(image.tags, nsfwMode);
  const isCurrentPlaylistItem = playlist.isActive && playlist.isPlaylistItem("image", image.id);

  // Auto-advance timer for playlist slideshow
  useEffect(() => {
    if (!isCurrentPlaylistItem || playlist.slideshowDurationSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      playlist.reportContentEnded("image", image.id);
    }, playlist.slideshowDurationSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [isCurrentPlaylistItem, playlist.slideshowDurationSeconds, image.id, playlist]);

  const clampZoom = useCallback((z: number) => Math.max(1, Math.min(8, z)), []);

  const startEdit = useCallback(() => {
    setEditRating(image.rating);
    setEditOrganized(image.organized);
    setEditIsNsfw(image.isNsfw ?? false);
    setEditTags(image.tags.map((t) => t.name));
    setEditPerformers(image.performers.map((p) => p.name));
    setEditing(true);
  }, [image]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateImage(image.id, {
        rating: editRating,
        organized: editOrganized,
        isNsfw: editIsNsfw,
        tagNames: editTags,
        performerNames: editPerformers,
      });
      const detail = await fetchImageDetail(image.id);
      setImage(detail);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [image.id, editRating, editOrganized, editIsNsfw, editTags, editPerformers]);

  const handleRatingClick = useCallback(
    (value: number) => {
      if (editing) {
        setEditRating((prev) => (prev === value ? null : value));
      } else {
        const newRating = image.rating === value ? null : value;
        void updateImage(image.id, { rating: newRating });
        setImage((prev) => ({ ...prev, rating: newRating }));
      }
    },
    [editing, image.id, image.rating],
  );

  const displayRating = editing ? editRating : image.rating;

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        href="/images"
        className="inline-flex items-center gap-1 text-[0.78rem] text-text-muted hover:text-text-secondary transition-colors duration-fast"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Images
      </Link>

      {/* Image viewer */}
      <div className="relative bg-black overflow-hidden" style={{ minHeight: "40vh" }}>
        {fullUrl && (
          <NsfwBlur
            isNsfw={image.isNsfw ?? false}
            className="flex items-center justify-center w-full min-h-[40vh]"
          >
            <div className="flex items-center justify-center w-full min-h-[40vh]">
              {isVideoImage(image) ? (
                <video
                  key={image.id}
                  src={fullUrl}
                  autoPlay
                  loop
                  playsInline
                  controls
                  className="max-h-[70vh] max-w-full object-contain"
                  style={{
                    transform: `scale(${zoom})`,
                    transition: "transform 0.15s ease-out",
                  }}
                />
              ) : (
                <img
                  src={fullUrl}
                  alt={image.title}
                  className="max-h-[70vh] max-w-full object-contain"
                  onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2.5))}
                  style={{
                    transform: `scale(${zoom})`,
                    cursor: zoom > 1 ? "zoom-out" : "zoom-in",
                    transition: "transform 0.15s ease-out",
                  }}
                  draggable={false}
                />
              )}
            </div>
          </NsfwBlur>
        )}

        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-1 py-0.5">
          <button
            onClick={() => setZoom(clampZoom(zoom - 0.5))}
            className="p-1 text-white/60 hover:text-white transition-colors"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-[0.6rem] font-mono text-white/50 w-8 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(clampZoom(zoom + 0.5))}
            className="p-1 text-white/60 hover:text-white transition-colors"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-heading font-medium text-text-primary truncate">
            {image.title}
          </h1>
          <div className="flex items-center gap-3 mt-1 text-[0.75rem] text-text-muted">
            {image.width && image.height && (
              <span className="font-mono">{image.width}×{image.height}</span>
            )}
            {image.format && (
              <span className="font-mono uppercase">{image.format}</span>
            )}
            {image.fileSize && (
              <span className="font-mono">{formatFileSize(image.fileSize)}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setCollectionModalOpen(true)}
            className="p-1.5 text-text-muted hover:text-text-accent transition-colors"
            title="Add to collection"
          >
            <FolderPlus className="h-4 w-4" />
          </button>
          {!editing && (
            <button
              onClick={startEdit}
              className="p-1.5 text-text-muted hover:text-text-accent transition-colors"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Rating */}
      <div className="flex gap-0.5">
        {[20, 40, 60, 80, 100].map((v) => (
          <button
            key={v}
            onClick={() => handleRatingClick(v)}
            className="p-0.5 transition-colors"
          >
            <Star
              className={cn(
                "h-5 w-5",
                displayRating != null && displayRating >= v
                  ? "text-accent-500 fill-accent-500"
                  : "text-text-disabled hover:text-accent-500/50",
              )}
            />
          </button>
        ))}
      </div>

      {/* Metadata */}
      <div className="space-y-3">
        {/* Organized */}
        {editing ? (
          <button
            onClick={() => setEditOrganized(!editOrganized)}
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 text-[0.78rem] transition-colors",
              editOrganized
                ? "bg-accent-950 text-accent-300"
                : "text-text-muted hover:bg-surface-3",
            )}
          >
            <CheckCircle2 className="h-4 w-4" />
            {editOrganized ? "Organized" : "Mark as organized"}
          </button>
        ) : image.organized ? (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-accent-950 text-accent-300 text-[0.78rem]">
            <CheckCircle2 className="h-4 w-4" />
            Organized
          </div>
        ) : null}

        {/* NSFW */}
        {editing ? (
          <NsfwEditToggle value={editIsNsfw} onChange={setEditIsNsfw} />
        ) : image.isNsfw ? (
          <NsfwChip />
        ) : null}

        {/* Gallery link */}
        {image.galleryId && (
          <div>
            <div className="text-kicker mb-1">Gallery</div>
            <Link
              href={`/galleries/${image.galleryId}`}
              className="text-[0.78rem] text-text-accent hover:underline"
            >
              View gallery
            </Link>
          </div>
        )}

        {/* Studio */}
        {image.studio && (
          <div>
            <div className="text-kicker mb-1">Studio</div>
            <Link
              href={`/studios/${image.studio.id}`}
              className="text-[0.78rem] text-text-primary hover:text-text-accent"
            >
              {image.studio.name}
            </Link>
          </div>
        )}

        {/* Performers */}
        <div>
          <div className="text-kicker mb-1">{terms.performers}</div>
          {editing ? (
            <ChipInput
              values={editPerformers}
              onChange={setEditPerformers}
              suggestions={availablePerformers.map((p) => ({ name: p.name, count: p.sceneCount }))}
              placeholder={`Add ${terms.performer.toLowerCase()}…`}
            />
          ) : image.performers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {image.performers.map((p) => (
                <Link
                  key={p.id}
                  href={`/performers/${p.id}`}
                  className="text-[0.78rem] text-text-primary hover:text-text-accent"
                >
                  {p.name}
                </Link>
              ))}
            </div>
          ) : (
            <span className="text-[0.68rem] text-text-disabled">None</span>
          )}
        </div>

        {/* Tags */}
        <div>
          <div className="text-kicker mb-1">Tags</div>
          {editing ? (
            <ChipInput
              values={editTags}
              onChange={setEditTags}
              suggestions={availableTags.map((t) => ({ name: t.name, count: t.sceneCount + (t.imageCount ?? 0) }))}
              placeholder="Add tag…"
            />
          ) : imageTagsVisible.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {imageTagsVisible.map((tag) => (
                <span
                  key={tag.id}
                  className="tag-chip tag-chip-default text-[0.6rem] inline-flex items-center gap-1"
                >
                  <NsfwTagLabel isNsfw={tag.isNsfw}>{tag.name}</NsfwTagLabel>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[0.68rem] text-text-disabled">No tags</span>
          )}
        </div>

        {/* Details */}
        {image.details && (
          <div>
            <div className="text-kicker mb-1">Details</div>
            <p className="text-[0.78rem] text-text-secondary whitespace-pre-wrap">
              {image.details}
            </p>
          </div>
        )}

        {/* File info */}
        <div className="separator" />
        <div>
          <div className="text-kicker mb-1">File Path</div>
          <p className="text-[0.65rem] font-mono text-text-muted break-all">
            {image.filePath}
          </p>
        </div>

        {/* Save/Cancel */}
        {editing && (
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[0.78rem]",
                "bg-accent-800 text-accent-100 hover:bg-accent-700 transition-colors",
                saving && "opacity-50 cursor-wait",
              )}
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-[0.78rem] text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        )}
      </div>

      <AddToCollectionModal
        open={collectionModalOpen}
        onClose={() => setCollectionModalOpen(false)}
        entityType="image"
        entityId={image.id}
        entityTitle={image.title}
      />
    </div>
  );
}
