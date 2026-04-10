"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { UploadCloud, Check, AlertCircle, Loader2 } from "lucide-react";
import { useUploader } from "./use-uploader";
import {
  acceptForCategory,
  categoryForTarget,
  type UploadTarget,
} from "./upload-types";
import { LibraryRootPicker } from "./library-root-picker";
import { AudioLibraryPicker } from "./audio-library-picker";

interface UploadDropZoneProps {
  target: UploadTarget;
  onUploaded?: () => void;
  children: ReactNode;
  /** Optional className for the drop surface wrapper. */
  className?: string;
  /** Label shown in the drop overlay. Defaults to a category-aware string. */
  dropLabel?: string;
  /**
   * When false, the drop zone passes drag events through but renders no
   * overlay and does not accept drops. Used to disable uploads on views
   * that do not have a resolvable context (e.g. top-level audio list).
   */
  enabled?: boolean;
}

/**
 * Wraps a list/grid with drag-and-drop file upload support. Renders an
 * absolutely-positioned "Drop to add" overlay while a drag is active
 * over the wrapper, and a status strip at the bottom of the wrapper
 * during and after upload.
 */
export function UploadDropZone({
  target,
  onUploaded,
  children,
  className,
  dropLabel,
  enabled = true,
}: UploadDropZoneProps) {
  const uploader = useUploader({ target, onUploaded });
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);
  const category = categoryForTarget(target);
  const accept = acceptForCategory(category);

  // Portable "is this a file drag?" check. `DataTransfer.types` is a
  // `ReadonlyArray<string>` in modern browsers but a `DOMStringList` in
  // some older Chromium builds — DOMStringList has `.contains()` but not
  // `.includes()`, so we iterate manually instead of calling either.
  const dragHasFiles = (dt: DataTransfer | null | undefined) => {
    if (!dt) return false;
    const types = dt.types;
    if (!types) return false;
    for (let i = 0; i < types.length; i += 1) {
      if (types[i] === "Files") return true;
    }
    return false;
  };

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!enabled) return;
      if (!dragHasFiles(e.dataTransfer)) return;
      // Claim the event so the browser treats this element as a valid
      // drop target. Without preventDefault on BOTH enter and over the
      // eventual `drop` event never fires.
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current += 1;
      setIsDragging(true);
    },
    [enabled],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!enabled) return;
      if (!dragHasFiles(e.dataTransfer)) return;
      // Must preventDefault on EVERY dragover — not just the first — or
      // the browser forgets we want the drop. This is the usual cause
      // of "drag hover shows the overlay but the drop does nothing".
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
    },
    [enabled],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (!enabled) return;
      // Do not gate on dragHasFiles here — once we're tracking a file
      // drag via the depth counter we need to decrement on EVERY leave,
      // otherwise nested children's leaves get skipped and the overlay
      // sticks after the user drags back out of the page.
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDragging(false);
      }
    },
    [enabled],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;
      setIsDragging(false);
      const dropped = e.dataTransfer?.files;
      if (!dropped || dropped.length === 0) return;
      void uploader.uploadFiles(dropped);
    },
    [enabled, uploader],
  );

  // Safety net: swallow stray file drops that land outside the drop
  // zone so the browser does not navigate the tab to the file. Without
  // this, a drop that misses the zone by a few pixels opens the file
  // in place of the app. The zone's own handlers still run first for
  // drops that DO land inside it — this only fires for drops that
  // bubble all the way up to the window with defaults intact.
  useEffect(() => {
    if (!enabled) return;
    const preventDefaultIfFiles = (e: DragEvent) => {
      if (!dragHasFiles(e.dataTransfer)) return;
      e.preventDefault();
    };
    const onWindowDrop = (e: DragEvent) => {
      if (dragHasFiles(e.dataTransfer)) {
        e.preventDefault();
      }
      dragDepthRef.current = 0;
      setIsDragging(false);
    };
    const onDragEndGlobal = () => {
      dragDepthRef.current = 0;
      setIsDragging(false);
    };
    window.addEventListener("dragover", preventDefaultIfFiles);
    window.addEventListener("drop", onWindowDrop);
    window.addEventListener("dragend", onDragEndGlobal);
    return () => {
      window.removeEventListener("dragover", preventDefaultIfFiles);
      window.removeEventListener("drop", onWindowDrop);
      window.removeEventListener("dragend", onDragEndGlobal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const total = uploader.files.length;
  const done = uploader.files.filter((f) => f.status === "done").length;
  const failed = uploader.files.filter((f) => f.status === "error").length;
  const showStatusStrip = total > 0;
  const errors = uploader.files.filter((f) => f.status === "error");

  return (
    <div
      className={className ?? "relative"}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}

      {isDragging && enabled ? (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 border border-accent-500/50 bg-surface-1/90 px-10 py-8 shadow-[0_0_48px_rgba(199,155,92,0.25)]">
            <UploadCloud className="h-10 w-10 text-accent-400" />
            <div className="text-sm font-medium text-text-primary">
              {dropLabel ?? `Drop ${category} files to import`}
            </div>
            <div className="text-[0.7rem] text-text-muted font-mono">
              {accept}
            </div>
          </div>
        </div>
      ) : null}

      {showStatusStrip ? (
        <div className="pointer-events-auto fixed bottom-4 right-4 z-40 w-[340px] border border-border-subtle bg-surface-2/95 backdrop-blur-md shadow-lg">
          <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
            <div className="flex items-center gap-2 text-[0.78rem] font-medium text-text-primary">
              {uploader.isUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-400" />
              ) : failed > 0 ? (
                <AlertCircle className="h-3.5 w-3.5 text-status-error" />
              ) : (
                <Check className="h-3.5 w-3.5 text-status-success" />
              )}
              <span>
                {uploader.isUploading
                  ? `Uploading ${done + 1} of ${total}`
                  : failed > 0
                    ? `Uploaded ${done} of ${total} (${failed} failed)`
                    : `Uploaded ${done} of ${total}`}
              </span>
            </div>
            <button
              onClick={uploader.resetState}
              className="text-[0.7rem] text-text-muted hover:text-text-primary"
              disabled={uploader.isUploading}
            >
              Dismiss
            </button>
          </div>
          {errors.length > 0 ? (
            <div className="max-h-40 overflow-y-auto px-3 py-2 space-y-1">
              {errors.map((entry, i) => (
                <div key={i} className="text-[0.68rem] text-status-error">
                  <span className="font-mono">{entry.file.name}</span> —{" "}
                  {entry.error}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <LibraryRootPicker
        open={uploader.needsRootPicker}
        roots={uploader.candidateRoots}
        onConfirm={uploader.confirmRootPick}
        onCancel={uploader.cancelRootPick}
      />

      <AudioLibraryPicker
        open={uploader.needsAudioLibraryPicker}
        libraries={uploader.candidateAudioLibraries}
        onConfirm={uploader.confirmAudioLibraryPick}
        onCancel={uploader.cancelAudioLibraryPick}
      />
    </div>
  );
}
