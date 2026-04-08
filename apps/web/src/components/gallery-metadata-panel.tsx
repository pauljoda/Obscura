"use client";

import { useState } from "react";
import {
  Star,
  CheckCircle2,
  Camera,
  Calendar,
  Edit2,
  Save,
  XCircle,
  Bookmark,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { updateGallery } from "../lib/api";
import { revalidateGalleryCache } from "../app/actions/revalidate-gallery";
import type { GalleryDetailDto, GalleryChapterDto } from "@obscura/contracts";
import { NsfwChip, NsfwEditToggle, NsfwTagLabel, tagsVisibleInNsfwMode } from "./nsfw/nsfw-gate";
import { useNsfw } from "./nsfw/nsfw-context";

interface GalleryMetadataPanelProps {
  gallery: GalleryDetailDto;
  onGalleryUpdate?: (updated: Partial<GalleryDetailDto>) => void;
  onChapterJump?: (imageIndex: number) => void;
}

export function GalleryMetadataPanel({
  gallery,
  onGalleryUpdate,
  onChapterJump,
}: GalleryMetadataPanelProps) {
  const { mode: nsfwMode } = useNsfw();
  const galleryTagsVisible = tagsVisibleInNsfwMode(gallery.tags, nsfwMode);
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState(gallery.title);
  const [editDetails, setEditDetails] = useState(gallery.details ?? "");
  const [editPhotographer, setEditPhotographer] = useState(gallery.photographer ?? "");
  const [editDate, setEditDate] = useState(gallery.date ?? "");
  const [editIsNsfw, setEditIsNsfw] = useState(gallery.isNsfw ?? false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateGallery(gallery.id, {
        title: editTitle,
        details: editDetails || null,
        photographer: editPhotographer || null,
        date: editDate || null,
        isNsfw: editIsNsfw,
      });
      onGalleryUpdate?.({
        title: editTitle,
        details: editDetails || null,
        photographer: editPhotographer || null,
        date: editDate || null,
        isNsfw: editIsNsfw,
      });
      if (result.affectedGalleryIds?.length) {
        await revalidateGalleryCache(result.affectedGalleryIds);
      }
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditTitle(gallery.title);
    setEditDetails(gallery.details ?? "");
    setEditPhotographer(gallery.photographer ?? "");
    setEditDate(gallery.date ?? "");
    setEditIsNsfw(gallery.isNsfw ?? false);
    setEditMode(false);
  };

  const handleRatingClick = async (rating: number) => {
    const newRating = gallery.rating === rating ? null : rating;
    try {
      await updateGallery(gallery.id, { rating: newRating });
      onGalleryUpdate?.({ rating: newRating });
    } catch {
      // silently fail
    }
  };

  const handleOrganizedToggle = async () => {
    try {
      await updateGallery(gallery.id, { organized: !gallery.organized });
      onGalleryUpdate?.({ organized: !gallery.organized });
    } catch {
      // silently fail
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with edit toggle */}
      <div className="flex items-start justify-between">
        {editMode ? (
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="flex-1 bg-surface-2 border border-border-subtle px-2 py-1 text-base font-heading text-text-primary focus:outline-none focus:border-accent-500"
          />
        ) : (
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-heading font-medium text-text-primary">
              {gallery.title}
            </h2>
            {gallery.isNsfw && <div className="mt-1"><NsfwChip /></div>}
          </div>
        )}
        <button
          onClick={editMode ? handleCancel : () => setEditMode(true)}
          className="ml-2 p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
        >
          {editMode ? <XCircle className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Rating */}
      <div>
        <div className="text-kicker mb-1.5">Rating</div>
        <div className="flex gap-0.5">
          {[20, 40, 60, 80, 100].map((value) => (
            <button
              key={value}
              onClick={() => handleRatingClick(value)}
              className="p-0.5 transition-colors"
            >
              <Star
                className={cn(
                  "h-5 w-5",
                  gallery.rating != null && gallery.rating >= value
                    ? "text-accent-500 fill-accent-500"
                    : "text-text-disabled"
                )}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Organized */}
      <button
        onClick={handleOrganizedToggle}
        className={cn(
          "flex items-center gap-2 w-full px-2 py-1.5 text-[0.78rem] transition-colors",
          gallery.organized
            ? "bg-accent-950 text-accent-300"
            : "text-text-muted hover:bg-surface-2"
        )}
      >
        <CheckCircle2 className="h-4 w-4" />
        {gallery.organized ? "Organized" : "Mark as organized"}
      </button>

      {/* Details */}
      {editMode ? (
        <div>
          <div className="text-kicker mb-1.5">Details</div>
          <textarea
            value={editDetails}
            onChange={(e) => setEditDetails(e.target.value)}
            rows={3}
            className="w-full bg-surface-2 border border-border-subtle px-2 py-1 text-[0.78rem] text-text-primary focus:outline-none focus:border-accent-500 resize-none"
          />
        </div>
      ) : gallery.details ? (
        <div>
          <div className="text-kicker mb-1.5">Details</div>
          <p className="text-[0.78rem] text-text-muted">{gallery.details}</p>
        </div>
      ) : null}

      {/* Photographer */}
      {editMode ? (
        <div>
          <div className="text-kicker mb-1.5">Photographer</div>
          <input
            value={editPhotographer}
            onChange={(e) => setEditPhotographer(e.target.value)}
            className="w-full bg-surface-2 border border-border-subtle px-2 py-1 text-[0.78rem] text-text-primary focus:outline-none focus:border-accent-500"
          />
        </div>
      ) : gallery.photographer ? (
        <div className="flex items-center gap-2 text-[0.78rem] text-text-muted">
          <Camera className="h-3.5 w-3.5" />
          {gallery.photographer}
        </div>
      ) : null}

      {/* Date */}
      {editMode ? (
        <div>
          <div className="text-kicker mb-1.5">Date</div>
          <input
            type="date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
            className="w-full bg-surface-2 border border-border-subtle px-2 py-1 text-[0.78rem] text-text-primary focus:outline-none focus:border-accent-500"
          />
        </div>
      ) : gallery.date ? (
        <div className="flex items-center gap-2 text-[0.78rem] text-text-muted">
          <Calendar className="h-3.5 w-3.5" />
          {gallery.date}
        </div>
      ) : null}

      {/* NSFW toggle (edit mode) */}
      {editMode && (
        <div className="flex items-center gap-3">
          <NsfwEditToggle value={editIsNsfw} onChange={setEditIsNsfw} />
          {editIsNsfw && <span className="text-[0.68rem] text-text-muted">Hidden in SFW mode</span>}
        </div>
      )}

      {/* Save button */}
      {editMode && (
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "flex items-center gap-2 w-full justify-center px-3 py-2 text-[0.78rem]",
            "bg-accent-800 text-accent-100 hover:bg-accent-700 transition-colors",
            saving && "opacity-50 cursor-wait"
          )}
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving..." : "Save changes"}
        </button>
      )}

      {/* Studio */}
      {gallery.studio && (
        <div>
          <div className="text-kicker mb-1.5">Studio</div>
          <span className="pill-accent px-2 py-0.5 text-[0.68rem]">
            {gallery.studio.name}
          </span>
        </div>
      )}

      {/* Tags */}
      {galleryTagsVisible.length > 0 && (
        <div>
          <div className="text-kicker mb-1.5">Tags</div>
          <div className="flex flex-wrap gap-1">
            {galleryTagsVisible.map((tag) => (
              <span key={tag.id} className="tag-chip tag-chip-default">
                <NsfwTagLabel isNsfw={tag.isNsfw}>{tag.name}</NsfwTagLabel>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actors */}
      {gallery.performers.length > 0 && (
        <div>
          <div className="text-kicker mb-1.5">Actors</div>
          <div className="space-y-1">
            {gallery.performers.map((performer) => (
              <a
                key={performer.id}
                href={`/performers/${performer.id}`}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface-2 transition-colors"
              >
                <div className="h-6 w-6 bg-surface-3 flex-shrink-0" />
                <span className="text-[0.78rem] text-text-primary">{performer.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Chapters */}
      {gallery.chapters.length > 0 && (
        <div>
          <div className="text-kicker mb-1.5">Chapters</div>
          <div className="space-y-0.5">
            {gallery.chapters.map((chapter) => (
              <button
                key={chapter.id}
                onClick={() => onChapterJump?.(chapter.imageIndex)}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-left text-[0.78rem] text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
              >
                <Bookmark className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="flex-1 truncate">{chapter.title}</span>
                <span className="text-[0.65rem] text-text-disabled">#{chapter.imageIndex}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="separator" />
      <div className="space-y-1 text-[0.65rem] text-text-disabled">
        <div>Type: {gallery.galleryType}</div>
        {gallery.folderPath && <div className="truncate">Path: {gallery.folderPath}</div>}
        {gallery.zipFilePath && <div className="truncate">File: {gallery.zipFilePath}</div>}
        <div>{gallery.imageCount} images</div>
      </div>
    </div>
  );
}
