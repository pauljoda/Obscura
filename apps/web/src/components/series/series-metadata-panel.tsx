"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  Edit2,
  FolderOpen,
  HardDrive,
  Loader2,
  Save,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import type { SceneFolderDetailDto } from "@obscura/contracts";
import { cn } from "@obscura/ui/lib/utils";
import {
  toApiUrl,
  fetchStudios,
  fetchPerformers,
  fetchTags,
  type StudioItem,
  type PerformerItem,
  type TagItem,
} from "../../lib/api";
import { NsfwChip, NsfwEditToggle, tagsVisibleInNsfwMode } from "../nsfw/nsfw-gate";
import { useNsfw } from "../nsfw/nsfw-context";
import { ChipInput } from "../shared/chip-input";
import { StarRatingPicker } from "../shared/star-rating-picker";

interface SeriesMetadataPanelProps {
  folder: SceneFolderDetailDto;
  coverBusy?: boolean;
  backdropBusy?: boolean;
  onSave: (patch: {
    customName?: string | null;
    isNsfw?: boolean;
    details?: string | null;
    studioName?: string | null;
    performerNames?: string[];
    tagNames?: string[];
    rating?: number | null;
    date?: string | null;
  }) => Promise<void>;
  onUploadCover: (file: File | undefined) => void;
  onDeleteCover: () => void;
  onUploadBackdrop: (file: File | undefined) => void;
  onDeleteBackdrop: () => void;
}

export function SeriesMetadataPanel({
  folder,
  coverBusy = false,
  backdropBusy = false,
  onSave,
  onUploadCover,
  onDeleteCover,
  onUploadBackdrop,
  onDeleteBackdrop,
}: SeriesMetadataPanelProps) {
  const { mode: nsfwMode } = useNsfw();
  const coverUrl = toApiUrl(folder.coverImagePath, folder.updatedAt);
  const backdropUrl = toApiUrl(folder.backdropImagePath, folder.updatedAt);

  const [editMode, setEditMode] = useState(false);
  const [editCustomName, setEditCustomName] = useState(folder.customName ?? "");
  const [editIsNsfw, setEditIsNsfw] = useState(folder.isNsfw);
  const [editDetails, setEditDetails] = useState(folder.details ?? "");
  const [editStudioName, setEditStudioName] = useState(folder.studio?.name ?? "");
  const [editStudioFocused, setEditStudioFocused] = useState(false);
  const [editPerformerNames, setEditPerformerNames] = useState<string[]>(
    folder.performers.map((p) => p.name),
  );
  const [editTagNames, setEditTagNames] = useState<string[]>(
    folder.tags.map((t) => t.name),
  );
  const [editRating, setEditRating] = useState<number | null>(folder.rating);
  const [editDate, setEditDate] = useState(folder.date ?? "");
  const [saving, setSaving] = useState(false);

  // Suggestion data for chip inputs
  const [allStudios, setAllStudios] = useState<StudioItem[]>([]);
  const [allPerformers, setAllPerformers] = useState<PerformerItem[]>([]);
  const [allTags, setAllTags] = useState<TagItem[]>([]);

  const beginEdit = () => {
    setEditCustomName(folder.customName ?? "");
    setEditIsNsfw(folder.isNsfw);
    setEditDetails(folder.details ?? "");
    setEditStudioName(folder.studio?.name ?? "");
    setEditPerformerNames(folder.performers.map((p) => p.name));
    setEditTagNames(folder.tags.map((t) => t.name));
    setEditRating(folder.rating);
    setEditDate(folder.date ?? "");
    setEditMode(true);
    // Fetch suggestions
    void Promise.all([
      fetchStudios({ nsfw: nsfwMode }),
      fetchPerformers({ nsfw: nsfwMode, sort: "scenes", order: "desc", limit: 400 }),
      fetchTags({ nsfw: nsfwMode }),
    ]).then(([s, p, t]) => {
      setAllStudios(s.studios);
      setAllPerformers(p.performers);
      setAllTags(t.tags);
    }).catch(() => {});
  };

  const handleCancel = () => {
    setEditMode(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        customName: editCustomName.trim() || null,
        isNsfw: editIsNsfw,
        details: editDetails.trim() || null,
        studioName: editStudioName.trim() || null,
        performerNames: editPerformerNames,
        tagNames: editTagNames,
        rating: editRating,
        date: editDate.trim() || null,
      });
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  };

  const filteredStudios = editStudioFocused
    ? (editStudioName.trim()
        ? allStudios.filter(
            (s) =>
              s.name.toLowerCase().includes(editStudioName.toLowerCase()) &&
              s.name.toLowerCase() !== editStudioName.toLowerCase()
          )
        : allStudios)
    : [];

  return (
    <div className="surface-panel space-y-4 p-4">
      {/* ── Header with edit toggle ─────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        {editMode ? (
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="text-kicker">Display name</div>
            <input
              value={editCustomName}
              onChange={(e) => setEditCustomName(e.target.value)}
              placeholder={folder.title}
              className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5 text-[0.85rem] font-heading text-text-primary focus:outline-none focus:border-accent-500 placeholder:text-text-disabled"
            />
            <p className="text-[0.65rem] text-text-disabled">
              Leave empty to use the directory name
            </p>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-heading font-medium text-text-primary truncate">
              {folder.displayTitle}
            </h2>
            {folder.customName && (
              <p className="mt-0.5 text-[0.68rem] text-text-disabled truncate">
                {folder.title}
              </p>
            )}
            {folder.isNsfw && (
              <div className="mt-1.5">
                <NsfwChip />
              </div>
            )}
          </div>
        )}
        <button
          onClick={editMode ? handleCancel : beginEdit}
          className="ml-2 p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
        >
          {editMode ? (
            <XCircle className="h-4 w-4" />
          ) : (
            <Edit2 className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* ── Library root ────────────────────────────────────── */}
      {folder.libraryRootLabel && (
        <div className="flex items-center gap-2 text-[0.78rem] text-text-muted">
          <HardDrive className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{folder.libraryRootLabel}</span>
        </div>
      )}

      {/* ── Edit-mode fields ────────────────────────────────── */}
      {editMode && (
        <div className="space-y-3">
          {/* NSFW */}
          <div>
            <div className="text-kicker mb-1.5">Content rating</div>
            <div className="flex items-center gap-3">
              <NsfwEditToggle value={editIsNsfw} onChange={setEditIsNsfw} />
              {editIsNsfw && (
                <span className="text-[0.68rem] text-text-muted">
                  Hidden in SFW mode
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="text-kicker mb-1.5">Description</div>
            <textarea
              value={editDetails}
              onChange={(e) => setEditDetails(e.target.value)}
              rows={3}
              placeholder="Add a description..."
              className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5 text-[0.82rem] text-text-primary focus:outline-none focus:border-accent-500 placeholder:text-text-disabled resize-y"
            />
          </div>

          {/* Studio with autocomplete */}
          <div>
            <div className="text-kicker mb-1.5">Studio</div>
            <div className="relative">
              <input
                value={editStudioName}
                onChange={(e) => setEditStudioName(e.target.value)}
                onFocus={() => setEditStudioFocused(true)}
                onBlur={() => setTimeout(() => setEditStudioFocused(false), 150)}
                placeholder="Studio name"
                className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5 text-[0.82rem] text-text-primary focus:outline-none focus:border-accent-500 placeholder:text-text-disabled"
              />
              {filteredStudios.length > 0 && (
                <div className="autocomplete-dropdown">
                  {filteredStudios.slice(0, 8).map((s) => (
                    <div
                      key={s.name}
                      className="autocomplete-item"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setEditStudioName(s.name);
                        setEditStudioFocused(false);
                      }}
                    >
                      {s.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {editStudioName.trim() &&
              !allStudios.some(
                (s) => s.name.toLowerCase() === editStudioName.trim().toLowerCase()
              ) && (
                <span className="text-[0.6rem] text-info-text mt-0.5 block">
                  New studio will be created
                </span>
              )}
          </div>

          {/* Performers chip input */}
          <div>
            <div className="text-kicker mb-1.5">Performers</div>
            <ChipInput
              values={editPerformerNames}
              onChange={setEditPerformerNames}
              suggestions={tagsVisibleInNsfwMode(allPerformers, nsfwMode).map((p) => ({
                name: p.name,
                count: p.sceneCount,
              }))}
              placeholder="Type to add performers..."
            />
          </div>

          {/* Tags chip input */}
          <div>
            <div className="text-kicker mb-1.5">Tags</div>
            <ChipInput
              values={editTagNames}
              onChange={setEditTagNames}
              suggestions={tagsVisibleInNsfwMode(allTags, nsfwMode).map((t) => ({
                name: t.name,
                count: t.sceneCount,
              }))}
              placeholder="Type to add tags..."
            />
          </div>

          {/* Date and Rating row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-kicker mb-1.5">Date</div>
              <input
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                placeholder="2020 - Present"
                className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5 text-[0.82rem] text-text-primary focus:outline-none focus:border-accent-500 placeholder:text-text-disabled"
              />
            </div>
            <div>
              <div className="text-kicker mb-1.5">Rating</div>
              <StarRatingPicker value={editRating} onChange={setEditRating} />
            </div>
          </div>

          {/* Save button */}
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className={cn(
              "flex items-center gap-2 w-full justify-center px-3 py-2 text-[0.78rem]",
              "bg-accent-800 text-accent-100 hover:bg-accent-700 transition-colors",
              saving && "opacity-50 cursor-wait",
            )}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}

      <div className="separator" />

      {/* ── Scene counts ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="surface-well px-3 py-2">
          <div className="text-[0.68rem] uppercase tracking-[0.14em] text-text-muted">
            Direct
          </div>
          <div className="mt-1 text-lg font-mono text-text-primary">
            {folder.directSceneCount}
          </div>
        </div>
        <div className="surface-well px-3 py-2">
          <div className="text-[0.68rem] uppercase tracking-[0.14em] text-text-muted">
            Total
          </div>
          <div className="mt-1 text-lg font-mono text-text-primary">
            {folder.totalSceneCount}
          </div>
        </div>
      </div>

      <div className="separator" />

      {/* ── Poster (cover) ──────────────────────────────────── */}
      <ImageUploadSection
        label="Poster image"
        imageUrl={coverUrl}
        hasImage={Boolean(folder.coverImagePath)}
        busy={coverBusy}
        displayTitle={folder.displayTitle}
        onUpload={onUploadCover}
        onDelete={onDeleteCover}
        fallbackText="Using auto preview fallback"
      />

      <div className="separator" />

      {/* ── Backdrop ────────────────────────────────────────── */}
      <ImageUploadSection
        label="Backdrop image"
        imageUrl={backdropUrl}
        hasImage={Boolean(folder.backdropImagePath)}
        busy={backdropBusy}
        displayTitle={folder.displayTitle}
        onUpload={onUploadBackdrop}
        onDelete={onDeleteBackdrop}
        fallbackText="No backdrop set"
        aspectClass="aspect-video"
      />

      <div className="separator" />

      {/* ── Info ─────────────────────────────────────────────── */}
      <div className="space-y-1.5 text-[0.65rem] text-text-disabled">
        <div className="flex items-start gap-2">
          <FolderOpen className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span className="break-all font-mono">{folder.folderPath}</span>
        </div>
        {folder.childFolderCount > 0 && (
          <div>
            {folder.childFolderCount} subfolder
            {folder.childFolderCount === 1 ? "" : "s"}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3" />
          Added {new Date(folder.createdAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

/* ── Reusable image upload section ─────────────────────────── */

function ImageUploadSection({
  label,
  imageUrl,
  hasImage,
  busy,
  displayTitle,
  onUpload,
  onDelete,
  fallbackText,
  aspectClass = "aspect-[2/3]",
}: {
  label: string;
  imageUrl: string | null | undefined;
  hasImage: boolean;
  busy: boolean;
  displayTitle: string;
  onUpload: (file: File | undefined) => void;
  onDelete: () => void;
  fallbackText: string;
  aspectClass?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="text-kicker">{label}</div>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={displayTitle}
          className={cn(
            "w-full object-cover border border-border-subtle",
            aspectClass,
          )}
        />
      ) : (
        <div
          className={cn(
            "surface-well flex items-center justify-center text-[0.72rem] text-text-muted",
            aspectClass,
          )}
        >
          {fallbackText}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 border border-border-subtle px-3 py-2 text-[0.75rem] text-text-secondary transition-colors duration-fast hover:border-border-accent hover:text-text-primary">
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Upload
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => onUpload(event.target.files?.[0])}
          />
        </label>
        {hasImage ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="inline-flex items-center gap-2 border border-border-subtle px-3 py-2 text-[0.75rem] text-text-secondary transition-colors duration-fast hover:border-red-400/50 hover:text-red-200 disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
