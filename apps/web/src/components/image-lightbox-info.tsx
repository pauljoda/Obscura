"use client";

import { useState, useCallback, useMemo } from "react";
import { X, Star, Pencil, Save, XCircle, CheckCircle2, Search } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { updateImage, type TagItem } from "../lib/api";
import type { ImageListItemDto } from "@obscura/contracts";
import { NsfwChip, NsfwEditToggle } from "./nsfw/nsfw-gate";

interface ImageLightboxInfoProps {
  image: ImageListItemDto;
  open: boolean;
  onClose: () => void;
  onImageUpdate?: (imageId: string, patch: Partial<ImageListItemDto>) => void;
  availableTags?: TagItem[];
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

export function ImageLightboxInfo({ image, open, onClose, onImageUpdate, availableTags = [] }: ImageLightboxInfoProps) {
  const [editing, setEditing] = useState(false);
  const [editRating, setEditRating] = useState<number | null>(image.rating);
  const [editOrganized, setEditOrganized] = useState(image.organized);
  const [editIsNsfw, setEditIsNsfw] = useState(image.isNsfw ?? false);
  const [editTags, setEditTags] = useState(image.tags.map((t) => t.name));
  const [tagSearch, setTagSearch] = useState("");
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset edit state when image changes
  const startEdit = useCallback(() => {
    setEditRating(image.rating);
    setEditOrganized(image.organized);
    setEditIsNsfw(image.isNsfw ?? false);
    setEditTags(image.tags.map((t) => t.name));
    setTagSearch("");
    setTagPickerOpen(false);
    setEditing(true);
  }, [image]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateImage(image.id, {
        rating: editRating,
        organized: editOrganized,
        isNsfw: editIsNsfw,
        tagNames: editTags,
      });
      onImageUpdate?.(image.id, {
        rating: editRating,
        organized: editOrganized,
        isNsfw: editIsNsfw,
        tags: editTags.map((name, i) => ({ id: `temp-${i}`, name })),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [image.id, editRating, editOrganized, editIsNsfw, editTags, onImageUpdate]);

  const handleRatingClick = useCallback((value: number) => {
    if (editing) {
      setEditRating((prev) => (prev === value ? null : value));
    } else {
      // Quick-rate without entering edit mode
      const newRating = image.rating === value ? null : value;
      void updateImage(image.id, { rating: newRating });
      onImageUpdate?.(image.id, { rating: newRating });
    }
  }, [editing, image.id, image.rating, onImageUpdate]);

  const addTag = useCallback((name: string) => {
    const trimmed = name.trim();
    if (trimmed && !editTags.includes(trimmed)) {
      setEditTags((prev) => [...prev, trimmed]);
    }
    setTagSearch("");
    setTagPickerOpen(false);
  }, [editTags]);

  const removeTag = useCallback((index: number) => {
    setEditTags((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const filteredAvailableTags = useMemo(() => {
    const query = tagSearch.toLowerCase();
    return availableTags
      .filter((t) => !editTags.includes(t.name))
      .filter((t) => !query || t.name.toLowerCase().includes(query));
  }, [availableTags, editTags, tagSearch]);

  const displayRating = editing ? editRating : image.rating;
  const displayTags = editing ? editTags.map((name, i) => ({ id: `edit-${i}`, name })) : image.tags;

  return (
    <div
      className={cn(
        "fixed top-0 right-0 h-full w-80 bg-surface-2 border-l border-border-subtle z-[101]",
        "transition-transform duration-moderate",
        open ? "translate-x-0" : "translate-x-full"
      )}
      style={{ transitionTimingFunction: "var(--ease-mechanical)" }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <span className="text-sm font-medium text-text-primary">
          {editing ? "Edit Image" : "Image Info"}
        </span>
        <div className="flex items-center gap-1">
          {!editing && (
            <button
              onClick={startEdit}
              className="flex h-6 w-6 items-center justify-center text-text-muted hover:text-text-accent hover:bg-surface-3 transition-colors"
              title="Edit metadata"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={editing ? cancelEdit : onClose}
            className="flex h-6 w-6 items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-48px)]">
        {/* Filename */}
        <div>
          <div className="text-kicker mb-1">Filename</div>
          <p className="text-[0.78rem] text-text-primary break-all">{image.title}</p>
        </div>

        {/* Rating — always interactive */}
        <div>
          <div className="text-kicker mb-1">Rating</div>
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
                      : "text-text-disabled hover:text-accent-500/50"
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Organized toggle */}
        {editing ? (
          <button
            onClick={() => setEditOrganized(!editOrganized)}
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 text-[0.78rem] transition-colors",
              editOrganized
                ? "bg-accent-950 text-accent-300"
                : "text-text-muted hover:bg-surface-3"
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
          <div className="flex items-center gap-2">
            <NsfwEditToggle value={editIsNsfw} onChange={setEditIsNsfw} />
          </div>
        ) : image.isNsfw ? (
          <NsfwChip />
        ) : null}

        {/* Tags */}
        <div>
          <div className="text-kicker mb-1">Tags</div>
          <div className="flex flex-wrap gap-1">
            {displayTags.map((tag, i) => (
              <span key={tag.id} className="tag-chip tag-chip-default text-[0.6rem] inline-flex items-center gap-1">
                {tag.name}
                {editing && (
                  <button
                    onClick={() => removeTag(i)}
                    className="text-text-disabled hover:text-status-error transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </span>
            ))}
            {!editing && displayTags.length === 0 && (
              <span className="text-[0.68rem] text-text-disabled">No tags</span>
            )}
          </div>
          {editing && (
            <div className="relative mt-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-text-disabled pointer-events-none" />
                <input
                  type="text"
                  value={tagSearch}
                  onChange={(e) => {
                    setTagSearch(e.target.value);
                    setTagPickerOpen(true);
                  }}
                  onFocus={() => setTagPickerOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tagSearch.trim()) {
                      e.preventDefault();
                      addTag(tagSearch);
                    }
                    if (e.key === "Escape") {
                      setTagPickerOpen(false);
                    }
                  }}
                  placeholder="Search or add tag..."
                  className="w-full bg-surface-1 border border-border-subtle pl-7 pr-2 py-1.5 text-[0.72rem] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent-500"
                />
              </div>
              {tagPickerOpen && (filteredAvailableTags.length > 0 || tagSearch.trim()) && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface-3 border border-border-subtle shadow-lg max-h-40 overflow-y-auto">
                  {filteredAvailableTags.slice(0, 20).map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => addTag(tag.name)}
                      className="flex items-center justify-between w-full px-2.5 py-1.5 text-[0.72rem] text-left text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
                    >
                      <span>{tag.name}</span>
                      <span className="text-text-disabled text-[0.6rem]">
                        {tag.sceneCount + (tag.imageCount ?? 0)}
                      </span>
                    </button>
                  ))}
                  {tagSearch.trim() && !availableTags.some((t) => t.name.toLowerCase() === tagSearch.trim().toLowerCase()) && (
                    <button
                      onClick={() => addTag(tagSearch)}
                      className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-[0.72rem] text-left text-text-accent hover:bg-surface-2 transition-colors border-t border-border-subtle"
                    >
                      Create &ldquo;{tagSearch.trim()}&rdquo;
                    </button>
                  )}
                  {filteredAvailableTags.length === 0 && !tagSearch.trim() && (
                    <div className="px-2.5 py-2 text-[0.68rem] text-text-disabled">No more tags available</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Save/Cancel buttons */}
        {editing && (
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[0.78rem]",
                "bg-accent-800 text-accent-100 hover:bg-accent-700 transition-colors",
                saving && "opacity-50 cursor-wait"
              )}
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={cancelEdit}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-[0.78rem] text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        )}

        <div className="separator" />

        {/* File details */}
        {(image.width || image.height) && (
          <div>
            <div className="text-kicker mb-1">Dimensions</div>
            <p className="text-mono-sm text-text-muted">
              {image.width} × {image.height}
            </p>
          </div>
        )}

        {image.fileSize && (
          <div>
            <div className="text-kicker mb-1">File Size</div>
            <p className="text-mono-sm text-text-muted">{formatFileSize(image.fileSize)}</p>
          </div>
        )}

        {image.format && (
          <div>
            <div className="text-kicker mb-1">Format</div>
            <p className="text-mono-sm text-text-muted">{image.format.toUpperCase()}</p>
          </div>
        )}
      </div>
    </div>
  );
}
