"use client";

import { Loader2, Trash2, Upload } from "lucide-react";
import type { SceneFolderDetailDto } from "@obscura/contracts";
import { toApiUrl } from "../../lib/api";
import { NsfwEditToggle } from "../nsfw/nsfw-gate";

interface SceneFolderMetadataPanelProps {
  folder: SceneFolderDetailDto;
  coverBusy?: boolean;
  nsfwBusy?: boolean;
  onUploadCover: (file: File | undefined) => void;
  onDeleteCover: () => void;
  onToggleNsfw: (value: boolean) => void;
}

export function SceneFolderMetadataPanel({
  folder,
  coverBusy = false,
  nsfwBusy = false,
  onUploadCover,
  onDeleteCover,
  onToggleNsfw,
}: SceneFolderMetadataPanelProps) {
  const coverUrl = toApiUrl(folder.coverImagePath, folder.updatedAt);

  return (
    <div className="surface-panel space-y-4 p-4">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">Folder metadata</h2>
        <p className="mt-1 text-[0.72rem] text-text-muted">
          Covers and NSFW state are stored on the folder and survive rescans while the path stays the same.
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-[0.68rem] uppercase tracking-[0.14em] text-text-muted">
          Folder path
        </div>
        <div className="surface-well break-all px-3 py-2 font-mono text-[0.72rem] text-text-secondary">
          {folder.folderPath}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="surface-well px-3 py-2">
          <div className="text-[0.68rem] uppercase tracking-[0.14em] text-text-muted">
            Direct scenes
          </div>
          <div className="mt-1 text-lg font-mono text-text-primary">
            {folder.directSceneCount}
          </div>
        </div>
        <div className="surface-well px-3 py-2">
          <div className="text-[0.68rem] uppercase tracking-[0.14em] text-text-muted">
            Total scenes
          </div>
          <div className="mt-1 text-lg font-mono text-text-primary">
            {folder.totalSceneCount}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[0.68rem] uppercase tracking-[0.14em] text-text-muted">
          NSFW
        </div>
        <NsfwEditToggle
          value={folder.isNsfw}
          onChange={onToggleNsfw}
        />
        {nsfwBusy ? (
          <div className="text-[0.68rem] text-text-disabled">Updating NSFW flag…</div>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="text-[0.68rem] uppercase tracking-[0.14em] text-text-muted">
          Custom cover
        </div>
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={folder.title}
            className="aspect-[4/3] w-full object-cover"
          />
        ) : (
          <div className="surface-well flex aspect-[4/3] items-center justify-center text-[0.75rem] text-text-muted">
            Using auto preview fallback
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 border border-border-subtle px-3 py-2 text-[0.75rem] text-text-secondary transition-colors duration-fast hover:border-border-accent hover:text-text-primary">
            {coverBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload cover
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
              Remove cover
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
