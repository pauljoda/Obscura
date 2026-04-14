"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  HardDrive,
  Star,
  User,
} from "lucide-react";
import type { SceneFolderDetailDto } from "@obscura/contracts";
import {
  deleteSceneFolderCover,
  deleteSceneFolderBackdrop,
  fetchSceneFolderDetail,
  fetchScenes,
  toApiUrl,
  updateSceneFolder,
  uploadSceneFolderCover,
  uploadSceneFolderBackdrop,
  type SceneListItem,
} from "../../lib/api";
import { HierarchyBreadcrumbs } from "../shared/hierarchy-breadcrumbs";
import { HierarchySection } from "../shared/hierarchy-section";
import { SceneFolderMetadataPanel } from "../scene-folders/scene-folder-metadata-panel";
import { SceneFolderCard } from "../scene-folders/scene-folder-card";
import { revalidateSceneFolderCache } from "../../app/actions/revalidate-scene-folder";
import { SceneGrid } from "../scene-grid";
import { BackLink } from "../shared/back-link";

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
  const [backdropBusy, setBackdropBusy] = useState(false);
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
    async (patch: {
      customName?: string | null;
      isNsfw?: boolean;
      details?: string | null;
      studioName?: string | null;
      performerNames?: string[];
      tagNames?: string[];
      rating?: number | null;
      date?: string | null;
    }) => {
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

  const handleUploadBackdrop = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);
      setBackdropBusy(true);
      try {
        await uploadSceneFolderBackdrop(folder.id, file);
        await revalidateSceneFolderCache(folder.id);
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload backdrop");
      } finally {
        setBackdropBusy(false);
      }
    },
    [folder.id, reload],
  );

  const handleDeleteBackdrop = useCallback(async () => {
    setError(null);
    setBackdropBusy(true);
    try {
      await deleteSceneFolderBackdrop(folder.id);
      await revalidateSceneFolderCache(folder.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete backdrop");
    } finally {
      setBackdropBusy(false);
    }
  }, [folder.id, reload]);

  const coverUrl = toApiUrl(folder.coverImagePath, folder.updatedAt);
  const backdropUrl = toApiUrl(folder.backdropImagePath, folder.updatedAt);

  return (
    <div className="space-y-4">
      {/* ── Back link ────────────────────────────────────────── */}
      <BackLink
        fallback={`/videos?folder=${folder.parentId ?? ""}`}
        label="Back to folder view"
        variant="text"
      />

      {/* ── Jellyfin-style Hero Header ──────────────────────── */}
      <div className="relative min-h-[320px] overflow-hidden border border-border-subtle">
        {/* Backdrop image or dark fallback */}
        {backdropUrl ? (
          <img
            src={backdropUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110 opacity-40"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-1 via-black/60 to-black/30" />

        {/* Content overlay: poster + metadata */}
        <div className="relative flex min-h-[320px] items-end gap-6 p-6">
          {/* Poster */}
          {coverUrl ? (
            <div className="hidden sm:block flex-shrink-0 w-[180px]">
              <img
                src={coverUrl}
                alt={folder.displayTitle}
                className="aspect-[2/3] w-full object-cover border border-white/10 shadow-lg"
              />
            </div>
          ) : null}

          {/* Metadata */}
          <div className="flex-1 min-w-0">
            {folder.libraryRootLabel && (
              <div className="flex items-center gap-1.5 text-[0.68rem] text-white/50 mb-1">
                <HardDrive className="h-3 w-3" />
                {folder.libraryRootLabel}
              </div>
            )}
            <div className="text-[0.72rem] uppercase tracking-[0.16em] text-white/60">
              Scene folder
            </div>
            <h1 className="mt-1.5 text-3xl font-heading font-semibold text-white">
              {folder.displayTitle}
            </h1>
            {folder.customName && (
              <p className="mt-0.5 text-[0.78rem] text-white/40">{folder.title}</p>
            )}

            {/* Metadata row: studio, date, rating, scene count */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.82rem] text-white/70">
              {folder.studio && (
                <Link
                  href={`/studios/${folder.studio.id}`}
                  className="hover:text-text-accent transition-colors"
                >
                  {folder.studio.name}
                </Link>
              )}
              {folder.date && (
                <span>{folder.date}</span>
              )}
              {folder.rating != null && (
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {folder.rating}
                </span>
              )}
              <span className="text-white/40">
                {folder.totalSceneCount} scene{folder.totalSceneCount !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Description */}
            {folder.details && (
              <p className="mt-3 max-w-[700px] text-[0.82rem] leading-relaxed text-white/60 line-clamp-3">
                {folder.details}
              </p>
            )}

            {/* Tags */}
            {folder.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="text-[0.72rem] text-white/40 mr-1 self-center">Tags:</span>
                {folder.tags.map((tag) => (
                  <Link
                    key={tag.id}
                    href={`/tags/${encodeURIComponent(tag.name)}`}
                    className="text-[0.72rem] text-white/60 hover:text-text-accent transition-colors"
                  >
                    {tag.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Breadcrumbs ──────────────────────────────────────── */}
      {folder.breadcrumbs.length > 0 && (
        <HierarchyBreadcrumbs
          items={folder.breadcrumbs.map((crumb) => ({
            id: crumb.id,
            title: crumb.displayTitle,
            href: `/videos?folder=${crumb.id}`,
          }))}
        />
      )}

      {/* ── Error banner ─────────────────────────────────────── */}
      {error ? (
        <div className="surface-well border border-red-500/30 px-3 py-2 text-[0.78rem] text-red-200">
          {error}
        </div>
      ) : null}

      {/* ── Cast & Crew ─────────────────────────────────────── */}
      {folder.performers.length > 0 && (
        <CastSection performers={folder.performers} />
      )}

      {/* ── Main content + sidebar ───────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {/* Child folders — hidden when empty */}
          {folder.children.length > 0 && (
            <HierarchySection title="Seasons">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {folder.children.map((child) => (
                  <SceneFolderCard
                    key={child.id}
                    folder={child}
                    href={`/videos?folder=${child.id}`}
                    compact
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
            backdropBusy={backdropBusy}
            onSave={handleSave}
            onUploadCover={handleUploadCover}
            onDeleteCover={handleDeleteCover}
            onUploadBackdrop={handleUploadBackdrop}
            onDeleteBackdrop={handleDeleteBackdrop}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Cast & Crew horizontal scroll ──────────────────────────── */

interface CastSectionProps {
  performers: {
    id: string;
    name: string;
    gender: string | null;
    imagePath: string | null;
    isNsfw: boolean;
  }[];
}

function CastSection({ performers }: CastSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.6;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-kicker">Cast & Crew</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => scroll("left")}
            className="p-1.5 text-text-muted hover:text-text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="p-1.5 text-text-muted hover:text-text-primary transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
      >
        {performers.map((performer) => {
          const imgUrl = toApiUrl(performer.imagePath);
          return (
            <Link
              key={performer.id}
              href={`/performers/${performer.id}`}
              className="flex-shrink-0 w-[120px] group"
            >
              <div className="aspect-[3/4] w-full overflow-hidden border border-border-subtle bg-surface-2">
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt={performer.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-text-disabled">
                    <User className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="mt-1.5 text-center">
                <div className="text-[0.75rem] text-text-primary truncate group-hover:text-text-accent transition-colors">
                  {performer.name}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
