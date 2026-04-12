"use client";

import { useState } from "react";
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
import { toApiUrl } from "../../lib/api";
import { NsfwChip, NsfwEditToggle } from "../nsfw/nsfw-gate";

interface SceneFolderMetadataPanelProps {
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

export function SceneFolderMetadataPanel({
  folder,
  coverBusy = false,
  backdropBusy = false,
  onSave,
  onUploadCover,
  onDeleteCover,
  onUploadBackdrop,
  onDeleteBackdrop,
}: SceneFolderMetadataPanelProps) {
  const coverUrl = toApiUrl(folder.coverImagePath, folder.updatedAt);
  const backdropUrl = toApiUrl(folder.backdropImagePath, folder.updatedAt);

  const [editMode, setEditMode] = useState(false);
  const [editCustomName, setEditCustomName] = useState(folder.customName ?? "");
  const [editIsNsfw, setEditIsNsfw] = useState(folder.isNsfw);
  const [editDetails, setEditDetails] = useState(folder.details ?? "");
  const [editStudioName, setEditStudioName] = useState(
    folder.studio?.name ?? "",
  );
  const [editPerformerNames, setEditPerformerNames] = useState(
    folder.performers.map((p) => p.name).join(", "),
  );
  const [editTagNames, setEditTagNames] = useState(
    folder.tags.map((t) => t.name).join(", "),
  );
  const [editRating, setEditRating] = useState(
    folder.rating != null ? String(folder.rating) : "",
  );
  const [editDate, setEditDate] = useState(folder.date ?? "");
  const [saving, setSaving] = useState(false);

  const beginEdit = () => {
    setEditCustomName(folder.customName ?? "");
    setEditIsNsfw(folder.isNsfw);
    setEditDetails(folder.details ?? "");
    setEditStudioName(folder.studio?.name ?? "");
    setEditPerformerNames(folder.performers.map((p) => p.name).join(", "));
    setEditTagNames(folder.tags.map((t) => t.name).join(", "));
    setEditRating(folder.rating != null ? String(folder.rating) : "");
    setEditDate(folder.date ?? "");
    setEditMode(true);
  };

  const handleCancel = () => {
    setEditMode(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ratingNum = editRating.trim()
        ? Number(editRating.trim())
        : null;
      await onSave({
        customName: editCustomName.trim() || null,
        isNsfw: editIsNsfw,
        details: editDetails.trim() || null,
        studioName: editStudioName.trim() || null,
        performerNames: editPerformerNames
          .split(",")
          .map((n) => n.trim())
          .filter(Boolean),
        tagNames: editTagNames
          .split(",")
          .map((n) => n.trim())
          .filter(Boolean),
        rating: ratingNum != null && !isNaN(ratingNum) ? ratingNum : null,
        date: editDate.trim() || null,
      });
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  };

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

          {/* Studio */}
          <div>
            <div className="text-kicker mb-1.5">Studio</div>
            <input
              value={editStudioName}
              onChange={(e) => setEditStudioName(e.target.value)}
              placeholder="Studio name"
              className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5 text-[0.82rem] text-text-primary focus:outline-none focus:border-accent-500 placeholder:text-text-disabled"
            />
          </div>

          {/* Performers */}
          <div>
            <div className="text-kicker mb-1.5">Performers</div>
            <input
              value={editPerformerNames}
              onChange={(e) => setEditPerformerNames(e.target.value)}
              placeholder="Name 1, Name 2, ..."
              className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5 text-[0.82rem] text-text-primary focus:outline-none focus:border-accent-500 placeholder:text-text-disabled"
            />
            <p className="text-[0.65rem] text-text-disabled mt-0.5">
              Comma-separated names
            </p>
          </div>

          {/* Tags */}
          <div>
            <div className="text-kicker mb-1.5">Tags</div>
            <input
              value={editTagNames}
              onChange={(e) => setEditTagNames(e.target.value)}
              placeholder="tag1, tag2, ..."
              className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5 text-[0.82rem] text-text-primary focus:outline-none focus:border-accent-500 placeholder:text-text-disabled"
            />
            <p className="text-[0.65rem] text-text-disabled mt-0.5">
              Comma-separated tag names
            </p>
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
              <input
                type="number"
                min={0}
                max={100}
                value={editRating}
                onChange={(e) => setEditRating(e.target.value)}
                placeholder="1-100"
                className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5 text-[0.82rem] text-text-primary focus:outline-none focus:border-accent-500 placeholder:text-text-disabled"
              />
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
