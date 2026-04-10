"use client";

import { useCallback, useRef, useState } from "react";
import { fetchApi, uploadFile } from "../../lib/api/core";
import type { LibraryRootSummaryDto } from "@obscura/contracts";
import {
  type UploadFileProgress,
  type UploadTarget,
  categoryForTarget,
} from "./upload-types";

interface UseUploaderOptions {
  target: UploadTarget;
  onUploaded?: () => void;
}

/**
 * Orchestration hook for drag-drop uploads and the Import button.
 *
 * - Resolves the scene upload flow's library root (auto-picks when there
 *   is exactly one eligible root, otherwise exposes `candidateRoots` so
 *   the caller can render a picker).
 * - Uploads files sequentially — concurrency is intentionally 1 because
 *   video uploads are large and most home-LAN deployments care more
 *   about a stable stream than parallelism.
 * - Tracks per-file state for the drop zone to render a status strip.
 */
export function useUploader({ target, onUploaded }: UseUploaderOptions) {
  const [files, setFiles] = useState<UploadFileProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [candidateRoots, setCandidateRoots] = useState<LibraryRootSummaryDto[]>(
    [],
  );
  // Pending queue stashed while the caller resolves a root pick.
  const pendingFilesRef = useRef<File[] | null>(null);
  const resolvedRootIdRef = useRef<string | null>(null);

  const resetState = useCallback(() => {
    setFiles([]);
  }, []);

  const runUploads = useCallback(
    async (fileList: File[], explicitRootId?: string) => {
      if (fileList.length === 0) return;
      const category = categoryForTarget(target);
      setIsUploading(true);
      setFiles(
        fileList.map((f) => ({ file: f, status: "pending" as const })),
      );

      for (let index = 0; index < fileList.length; index += 1) {
        const file = fileList[index];
        setFiles((prev) =>
          prev.map((entry, i) =>
            i === index ? { ...entry, status: "uploading" } : entry,
          ),
        );
        try {
          if (target.kind === "scene") {
            const libraryRootId =
              explicitRootId ??
              target.libraryRootId ??
              resolvedRootIdRef.current;
            if (!libraryRootId) {
              throw new Error("No library root selected for scene upload");
            }
            await uploadFile("/scenes/upload", file, {
              libraryRootId,
            });
          } else if (target.kind === "image") {
            await uploadFile(
              `/galleries/${target.galleryId}/images/upload`,
              file,
            );
          } else if (target.kind === "audio") {
            await uploadFile(
              `/audio-libraries/${target.audioLibraryId}/tracks/upload`,
              file,
            );
          }
          setFiles((prev) =>
            prev.map((entry, i) =>
              i === index ? { ...entry, status: "done" } : entry,
            ),
          );
        } catch (error) {
          setFiles((prev) =>
            prev.map((entry, i) =>
              i === index
                ? {
                    ...entry,
                    status: "error",
                    error:
                      error instanceof Error
                        ? error.message
                        : "Upload failed",
                  }
                : entry,
            ),
          );
        }
      }

      setIsUploading(false);
      // Void the category reference so unused-var lint stays quiet when
      // the branches above don't all read it — the category still drives
      // client-side accept filtering in the drop zone.
      void category;
      onUploaded?.();
    },
    [target, onUploaded],
  );

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const asArray = Array.from(fileList);
      if (asArray.length === 0) return;

      if (target.kind === "scene" && !target.libraryRootId) {
        // Fetch eligible library roots. If exactly one — use it. If more
        // than one — hand off to the caller's picker UI. If zero — fail
        // with a clear message via the per-file error state.
        let roots: LibraryRootSummaryDto[] = [];
        try {
          const resp = await fetchApi<{ roots: LibraryRootSummaryDto[] }>(
            "/libraries?scanVideos=true&enabled=true",
          );
          roots = resp.roots ?? [];
        } catch (error) {
          setFiles(
            asArray.map((f) => ({
              file: f,
              status: "error",
              error:
                error instanceof Error
                  ? error.message
                  : "Could not load library roots",
            })),
          );
          return;
        }

        if (roots.length === 0) {
          setFiles(
            asArray.map((f) => ({
              file: f,
              status: "error",
              error: "No library root is configured to accept video uploads",
            })),
          );
          return;
        }

        if (roots.length === 1) {
          resolvedRootIdRef.current = roots[0].id;
          await runUploads(asArray, roots[0].id);
          return;
        }

        // Multiple candidates — stash the files and expose the picker.
        pendingFilesRef.current = asArray;
        setCandidateRoots(roots);
        return;
      }

      await runUploads(asArray);
    },
    [target, runUploads],
  );

  const confirmRootPick = useCallback(
    async (rootId: string) => {
      const pending = pendingFilesRef.current;
      pendingFilesRef.current = null;
      setCandidateRoots([]);
      resolvedRootIdRef.current = rootId;
      if (pending) {
        await runUploads(pending, rootId);
      }
    },
    [runUploads],
  );

  const cancelRootPick = useCallback(() => {
    pendingFilesRef.current = null;
    setCandidateRoots([]);
    setFiles([]);
  }, []);

  return {
    files,
    isUploading,
    needsRootPicker: candidateRoots.length > 0,
    candidateRoots,
    uploadFiles,
    confirmRootPick,
    cancelRootPick,
    resetState,
  };
}
