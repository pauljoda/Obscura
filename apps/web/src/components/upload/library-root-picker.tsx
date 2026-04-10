"use client";

import { useEffect } from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "@obscura/ui/primitives/button";
import type { LibraryRootSummaryDto } from "@obscura/contracts";

interface LibraryRootPickerProps {
  open: boolean;
  roots: LibraryRootSummaryDto[];
  onConfirm: (rootId: string) => void;
  onCancel: () => void;
}

/**
 * Modal shown when a scene upload has more than one eligible library
 * root (scanVideos + enabled) and the current view has no implicit
 * root context. Single-root and zero-root cases are resolved silently
 * inside use-uploader.
 */
export function LibraryRootPicker({
  open,
  roots,
  onConfirm,
  onCancel,
}: LibraryRootPickerProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative surface-elevated border border-border-subtle w-full max-w-lg mx-4 p-6 space-y-5">
        <div className="space-y-1.5">
          <h3 className="text-base font-heading font-semibold text-text-primary">
            Choose a library root
          </h3>
          <p className="text-[0.78rem] text-text-muted leading-relaxed">
            More than one enabled library root accepts video uploads. Pick
            the destination for this batch.
          </p>
        </div>

        <div className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto">
          {roots.map((root) => (
            <button
              key={root.id}
              onClick={() => onConfirm(root.id)}
              className="group flex w-full items-center gap-3 border border-border-subtle bg-surface-1 px-3.5 py-3 text-left transition-colors duration-fast hover:border-border-accent hover:bg-surface-2"
            >
              <FolderOpen className="h-4 w-4 flex-shrink-0 text-text-muted group-hover:text-accent-400" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-text-primary truncate">
                  {root.label}
                </div>
                <div className="text-[0.7rem] text-text-muted font-mono truncate">
                  {root.path}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" size="md" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
