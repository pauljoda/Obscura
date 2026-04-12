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
  onSave: (patch: { customName?: string | null; isNsfw?: boolean }) => Promise<void>;
  onUploadCover: (file: File | undefined) => void;
  onDeleteCover: () => void;
}

export function SceneFolderMetadataPanel({
  folder,
  coverBusy = false,
  onSave,
  onUploadCover,
  onDeleteCover,
}: SceneFolderMetadataPanelProps) {
  const coverUrl = toApiUrl(folder.coverImagePath, folder.updatedAt);

  const [editMode, setEditMode] = useState(false);
  const [editCustomName, setEditCustomName] = useState(folder.customName ?? "");
  const [editIsNsfw, setEditIsNsfw] = useState(folder.isNsfw);
  const [saving, setSaving] = useState(false);

  const beginEdit = () => {
    setEditCustomName(folder.customName ?? "");
    setEditIsNsfw(folder.isNsfw);
    setEditMode(true);
  };

  const handleCancel = () => {
    setEditCustomName(folder.customName ?? "");
    setEditIsNsfw(folder.isNsfw);
    setEditMode(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        customName: editCustomName.trim() || null,
        isNsfw: editIsNsfw,
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
          {editMode ? <XCircle className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
        </button>
      </div>

      {/* ── Library root ────────────────────────────────────── */}
      {folder.libraryRootLabel && (
        <div className="flex items-center gap-2 text-[0.78rem] text-text-muted">
          <HardDrive className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{folder.libraryRootLabel}</span>
        </div>
      )}

      {/* ── NSFW toggle (edit mode only) ────────────────────── */}
      {editMode && (
        <div>
          <div className="text-kicker mb-1.5">Content rating</div>
          <div className="flex items-center gap-3">
            <NsfwEditToggle value={editIsNsfw} onChange={setEditIsNsfw} />
            {editIsNsfw && (
              <span className="text-[0.68rem] text-text-muted">Hidden in SFW mode</span>
            )}
          </div>
        </div>
      )}

      {/* ── Save button ─────────────────────────────────────── */}
      {editMode && (
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

      {/* ── Custom cover ────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-kicker">Cover image</div>
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={folder.displayTitle}
            className="aspect-video w-full object-cover border border-border-subtle"
          />
        ) : (
          <div className="surface-well flex aspect-video items-center justify-center text-[0.72rem] text-text-muted">
            Using auto preview fallback
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 border border-border-subtle px-3 py-2 text-[0.75rem] text-text-secondary transition-colors duration-fast hover:border-border-accent hover:text-text-primary">
            {coverBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => onUploadCover(event.target.files?.[0])}
            />
          </label>
          {folder.coverImagePath ? (
            <button
              type="button"
              onClick={onDeleteCover}
              disabled={coverBusy}
              className="inline-flex items-center gap-2 border border-border-subtle px-3 py-2 text-[0.75rem] text-text-secondary transition-colors duration-fast hover:border-red-400/50 hover:text-red-200 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          ) : null}
        </div>
      </div>

      <div className="separator" />

      {/* ── Info ─────────────────────────────────────────────── */}
      <div className="space-y-1.5 text-[0.65rem] text-text-disabled">
        <div className="flex items-start gap-2">
          <FolderOpen className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span className="break-all font-mono">{folder.folderPath}</span>
        </div>
        {folder.childFolderCount > 0 && (
          <div>
            {folder.childFolderCount} subfolder{folder.childFolderCount === 1 ? "" : "s"}
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
