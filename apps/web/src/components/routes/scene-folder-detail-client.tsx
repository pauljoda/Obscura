"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ChevronLeft, FolderOpen, HardDrive } from "lucide-react";
import type { SceneFolderDetailDto } from "@obscura/contracts";
import {
  deleteSceneFolderCover,
  fetchSceneFolderDetail,
  fetchScenes,
  toApiUrl,
  updateSceneFolder,
  uploadSceneFolderCover,
  type SceneListItem,
} from "../../lib/api";
import { HierarchyBreadcrumbs } from "../shared/hierarchy-breadcrumbs";
import { HierarchySection } from "../shared/hierarchy-section";
import { SceneFolderMetadataPanel } from "../scene-folders/scene-folder-metadata-panel";
import { SceneFolderCard } from "../scene-folders/scene-folder-card";
import { revalidateSceneFolderCache } from "../../app/actions/revalidate-scene-folder";
import { SceneGrid } from "../scene-grid";

interface SceneFolderDetailClientProps {
  initialFolder: SceneFolderDetailDto;
  initialScenes: SceneListItem[];
  nsfwMode: string;
}

export function SceneFolderDetailClient({
  initialFolder,
  initialScenes,
  nsfwMode,
}: SceneFolderDetailClientProps) {
  const [folder, setFolder] = useState(initialFolder);
  const [scenes, setScenes] = useState(initialScenes);
  const [coverBusy, setCoverBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [nextFolder, nextScenes] = await Promise.all([
      fetchSceneFolderDetail(folder.id, { nsfw: nsfwMode }),
      fetchScenes({
        sceneFolderId: folder.id,
        folderScope: "direct",
        limit: 100,
        nsfw: nsfwMode,
      }),
    ]);
    setFolder(nextFolder);
    setScenes(nextScenes.scenes);
  }, [folder.id, nsfwMode]);

  const handleSave = useCallback(
    async (patch: { customName?: string | null; isNsfw?: boolean }) => {
      setError(null);
      try {
        await updateSceneFolder(folder.id, patch);
        await revalidateSceneFolderCache(folder.id);
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update folder");
        throw err;
      }
    },
    [folder.id, reload],
  );

  const handleUploadCover = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);
      setCoverBusy(true);
      try {
        await uploadSceneFolderCover(folder.id, file);
        await revalidateSceneFolderCache(folder.id);
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload cover");
      } finally {
        setCoverBusy(false);
      }
    },
    [folder.id, reload],
  );

  const handleDeleteCover = useCallback(async () => {
    setError(null);
    setCoverBusy(true);
    try {
      await deleteSceneFolderCover(folder.id);
      await revalidateSceneFolderCache(folder.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete cover");
    } finally {
      setCoverBusy(false);
    }
  }, [folder.id, reload]);

  const coverUrl = toApiUrl(folder.coverImagePath, folder.updatedAt);

  return (
    <div className="space-y-4">
      {/* ── Back link ────────────────────────────────────────── */}
      <Link
        href={`/scenes?folder=${folder.parentId ?? ""}`}
        className="inline-flex items-center gap-2 text-[0.78rem] text-text-muted transition-colors duration-fast hover:text-text-accent"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to folder view
      </Link>

      {/* ── Hero cover ───────────────────────────────────────── */}
      {coverUrl ? (
        <div className="relative min-h-[220px] overflow-hidden border border-border-subtle">
          <img
            src={coverUrl}
            alt={folder.displayTitle}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />
          <div className="relative flex min-h-[220px] items-end p-6">
            <div>
              {folder.libraryRootLabel && (
                <div className="flex items-center gap-1.5 text-[0.68rem] text-white/60 mb-1">
                  <HardDrive className="h-3 w-3" />
                  {folder.libraryRootLabel}
                </div>
              )}
              <div className="text-[0.72rem] uppercase tracking-[0.16em] text-white/70">
                Scene folder
              </div>
              <h1 className="mt-1.5 text-3xl font-semibold text-white">
                {folder.displayTitle}
              </h1>
              {folder.customName && (
                <p className="mt-1 text-[0.78rem] text-white/50">{folder.title}</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Breadcrumbs ──────────────────────────────────────── */}
      {folder.breadcrumbs.length > 0 && (
        <HierarchyBreadcrumbs
          items={folder.breadcrumbs.map((crumb) => ({
            id: crumb.id,
            title: crumb.displayTitle,
            href: `/scenes?folder=${crumb.id}`,
          }))}
        />
      )}

      {/* ── Title (no cover fallback) ────────────────────────── */}
      {!coverUrl && (
        <div>
          <div className="flex items-center gap-2.5">
            <FolderOpen className="h-5 w-5 text-text-accent" />
            <h1 className="text-2xl font-semibold text-text-primary">
              {folder.displayTitle}
            </h1>
          </div>
          {folder.customName && (
            <p className="mt-1 ml-[30px] text-[0.78rem] text-text-muted">{folder.title}</p>
          )}
          {folder.libraryRootLabel && (
            <div className="mt-1.5 ml-[30px] flex items-center gap-1.5 text-[0.72rem] text-text-disabled">
              <HardDrive className="h-3 w-3" />
              {folder.libraryRootLabel}
            </div>
          )}
        </div>
      )}

      {/* ── Error banner ─────────────────────────────────────── */}
      {error ? (
        <div className="surface-well border border-red-500/30 px-3 py-2 text-[0.78rem] text-red-200">
          {error}
        </div>
      ) : null}

      {/* ── Main content + sidebar ───────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {/* Child folders — hidden when empty */}
          {folder.children.length > 0 && (
            <HierarchySection title="Subfolders">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {folder.children.map((child) => (
                  <SceneFolderCard
                    key={child.id}
                    folder={child}
                    href={`/scenes?folder=${child.id}`}
                  />
                ))}
              </div>
            </HierarchySection>
          )}

          {/* Scenes in this folder */}
          <HierarchySection title="Scenes">
            <SceneGrid scenes={scenes} viewMode="grid" />
          </HierarchySection>
        </div>

        {/* ── Sticky metadata panel ──────────────────────────── */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <SceneFolderMetadataPanel
            folder={folder}
            coverBusy={coverBusy}
            onSave={handleSave}
            onUploadCover={handleUploadCover}
            onDeleteCover={handleDeleteCover}
          />
        </div>
      </div>
    </div>
  );
}
