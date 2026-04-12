"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ChevronLeft, FolderOpen } from "lucide-react";
import type { SceneFolderDetailDto } from "@obscura/contracts";
import {
  deleteSceneFolderCover,
  fetchSceneFolderDetail,
  toApiUrl,
  updateSceneFolder,
  uploadSceneFolderCover,
} from "../../lib/api";
import { HierarchyBreadcrumbs } from "../shared/hierarchy-breadcrumbs";
import { HierarchyShell } from "../shared/hierarchy-shell";
import { HierarchySection } from "../shared/hierarchy-section";
import { SceneFolderMetadataPanel } from "../scene-folders/scene-folder-metadata-panel";
import { SceneFolderCard } from "../scene-folders/scene-folder-card";
import { revalidateSceneFolderCache } from "../../app/actions/revalidate-scene-folder";

interface SceneFolderDetailClientProps {
  initialFolder: SceneFolderDetailDto;
  nsfwMode: string;
}

export function SceneFolderDetailClient({
  initialFolder,
  nsfwMode,
}: SceneFolderDetailClientProps) {
  const [folder, setFolder] = useState(initialFolder);
  const [coverBusy, setCoverBusy] = useState(false);
  const [nsfwBusy, setNsfwBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const next = await fetchSceneFolderDetail(folder.id, { nsfw: nsfwMode });
    setFolder(next);
  }, [folder.id, nsfwMode]);

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

  const handleToggleNsfw = useCallback(
    async (value: boolean) => {
      setError(null);
      setNsfwBusy(true);
      try {
        await updateSceneFolder(folder.id, { isNsfw: value });
        await revalidateSceneFolderCache(folder.id);
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update folder");
      } finally {
        setNsfwBusy(false);
      }
    },
    [folder.id, reload],
  );

  const coverUrl = toApiUrl(folder.coverImagePath, folder.updatedAt);

  return (
    <div className="space-y-4">
      <Link
        href={`/scenes?folder=${folder.id}`}
        className="inline-flex items-center gap-2 text-[0.78rem] text-text-muted transition-colors duration-fast hover:text-text-accent"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to scenes folder view
      </Link>

      {coverUrl ? (
        <div className="relative min-h-[240px] overflow-hidden border border-border-subtle">
          <img
            src={coverUrl}
            alt={folder.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10" />
          <div className="relative flex min-h-[240px] items-end p-6">
            <div>
              <div className="text-[0.72rem] uppercase tracking-[0.16em] text-white/70">
                Scene folder
              </div>
              <h1 className="mt-2 text-3xl font-semibold text-white">{folder.title}</h1>
            </div>
          </div>
        </div>
      ) : null}

      <HierarchyShell
        breadcrumbs={
          <HierarchyBreadcrumbs
            items={folder.breadcrumbs.map((crumb) => ({
              id: crumb.id,
              title: crumb.title,
              href: `/scenes?folder=${crumb.id}`,
            }))}
          />
        }
        title={
          coverUrl ? null : (
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-text-accent" />
              <h1 className="text-2xl font-semibold text-text-primary">{folder.title}</h1>
            </div>
          )
        }
      >
        {error ? (
          <div className="surface-well border border-red-500/30 px-3 py-2 text-[0.78rem] text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <HierarchySection title="Child folders">
              {folder.children.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {folder.children.map((child) => (
                    <SceneFolderCard
                      key={child.id}
                      folder={child}
                      href={`/scenes?folder=${child.id}`}
                    />
                  ))}
                </div>
              ) : (
                <div className="surface-well px-4 py-10 text-center text-[0.78rem] text-text-muted">
                  No child folders in this directory.
                </div>
              )}
            </HierarchySection>
          </div>

          <SceneFolderMetadataPanel
            folder={folder}
            coverBusy={coverBusy}
            nsfwBusy={nsfwBusy}
            onUploadCover={handleUploadCover}
            onDeleteCover={handleDeleteCover}
            onToggleNsfw={handleToggleNsfw}
          />
        </div>
      </HierarchyShell>
    </div>
  );
}
