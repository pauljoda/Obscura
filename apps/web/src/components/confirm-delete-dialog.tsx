"use client";

import { useCallback, useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@obscura/ui/primitives/button";

export type DeletableEntity =
  | "video"
  | "performer"
  | "studio"
  | "tag"
  | "image"
  | "audio-track"
  | "gallery"
  | "audio-library";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  entityType: DeletableEntity;
  count: number;
  onDeleteFromLibrary: () => void;
  /**
   * When provided together with `allowDeleteFromDisk`, renders a second
   * "Delete from disk" button that also unlinks the source file. If
   * omitted, only the single "Delete" button is shown.
   */
  onDeleteFromDisk?: () => void;
  /**
   * Explicitly opts into showing the secondary "Delete from disk"
   * button. Scenes have historically shown this by default — pass
   * `true` at the scene call sites to keep that behavior. Defaults to
   * `false` so new entity types show only the primary delete button
   * unless the caller wants the disk-wipe affordance.
   */
  allowDeleteFromDisk?: boolean;
  loading?: boolean;
}

const entityLabels: Record<DeletableEntity, { singular: string; plural: string }> = {
  video: { singular: "video", plural: "videos" },
  performer: { singular: "actor", plural: "actors" },
  studio: { singular: "studio", plural: "studios" },
  tag: { singular: "tag", plural: "tags" },
  image: { singular: "image", plural: "images" },
  "audio-track": { singular: "track", plural: "tracks" },
  gallery: { singular: "gallery", plural: "galleries" },
  "audio-library": { singular: "audio library", plural: "audio libraries" },
};

export function ConfirmDeleteDialog({
  open,
  onClose,
  entityType,
  count,
  onDeleteFromLibrary,
  onDeleteFromDisk,
  allowDeleteFromDisk,
  loading,
}: ConfirmDeleteDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    },
    [onClose, loading],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  const label = entityLabels[entityType] ?? { singular: entityType, plural: entityType + "s" };
  const noun = count === 1 ? label.singular : label.plural;
  // Show the two-button "library vs disk" layout whenever the caller
  // explicitly enabled it AND provided an onDeleteFromDisk callback.
  // Video call sites get this by default to preserve their UX
  // when they pass `allowDeleteFromDisk` alongside the existing
  // onDeleteFromDisk prop.
  const showDiskOption =
    (allowDeleteFromDisk ?? entityType === "video") &&
    typeof onDeleteFromDisk === "function";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
      />

      {/* Dialog */}
      <div className="relative surface-elevated border border-border-subtle w-full max-w-md mx-4 p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-status-error/15 border border-status-error/30 flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-status-error" />
          </div>
          <div>
            <h3 className="text-base font-heading font-semibold text-text-primary">
              Delete {count} {noun}
            </h3>
            <p className="mt-1.5 text-[0.78rem] text-text-muted leading-relaxed">
              {showDiskOption
                ? `This will permanently remove the selected ${noun} from the library. Generated files will be deleted. You can also remove the source file${count === 1 ? "" : "s"} from disk.`
                : `This will permanently delete the selected ${noun}. All associations and generated files will be removed.`}
            </p>
            <p className="mt-1 text-[0.72rem] text-status-error font-medium">
              This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {showDiskOption ? (
            <>
              <Button
                variant="danger"
                size="md"
                className="w-full justify-center"
                onClick={onDeleteFromLibrary}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Delete from library
              </Button>
              {onDeleteFromDisk && (
                <button
                  onClick={onDeleteFromDisk}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium text-status-error border border-status-error/30 bg-transparent hover:bg-status-error/10 transition-colors duration-fast disabled:opacity-40 disabled:pointer-events-none"
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Delete from disk
                </button>
              )}
            </>
          ) : (
            <Button
              variant="danger"
              size="md"
              className="w-full justify-center"
              onClick={onDeleteFromLibrary}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Delete {noun}
            </Button>
          )}

          <Button
            variant="ghost"
            size="md"
            className="w-full justify-center"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
