"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Search } from "lucide-react";
import { Button } from "@obscura/ui/primitives/button";
import type { AudioLibraryListItemDto } from "@obscura/contracts";

interface AudioLibraryPickerProps {
  open: boolean;
  libraries: AudioLibraryListItemDto[];
  onConfirm: (libraryId: string) => void;
  onCancel: () => void;
}

/**
 * Modal shown when an audio upload happens on a view that has no
 * implicit library context (the top-level /audio page). Lists every
 * existing audio library and lets the user pick where the batch should
 * land. A filter box is included because users commonly have dozens of
 * libraries.
 */
export function AudioLibraryPicker({
  open,
  libraries,
  onConfirm,
  onCancel,
}: AudioLibraryPickerProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  const filtered = useMemo(() => {
    if (!query.trim()) return libraries;
    const needle = query.trim().toLowerCase();
    return libraries.filter((l) => l.title.toLowerCase().includes(needle));
  }, [libraries, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative surface-elevated border border-border-subtle w-full max-w-lg mx-4 p-6 space-y-4">
        <div className="space-y-1.5">
          <h3 className="text-base font-heading font-semibold text-text-primary">
            Choose an audio library
          </h3>
          <p className="text-[0.78rem] text-text-muted leading-relaxed">
            Pick the library these tracks should land in. Only libraries
            with an on-disk folder can receive new uploads.
          </p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter libraries…"
            className="w-full border border-border-subtle bg-surface-1 pl-8 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-500"
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">
              No matching libraries
            </p>
          ) : (
            filtered.map((library) => (
              <button
                key={library.id}
                onClick={() => onConfirm(library.id)}
                className="group flex w-full items-center gap-3 border border-border-subtle bg-surface-1 px-3.5 py-3 text-left transition-colors duration-fast hover:border-border-accent hover:bg-surface-2"
              >
                <FolderOpen className="h-4 w-4 flex-shrink-0 text-text-muted group-hover:text-accent-400" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text-primary truncate">
                    {library.title}
                  </div>
                  <div className="text-[0.7rem] text-text-muted">
                    {library.trackCount} tracks
                  </div>
                </div>
              </button>
            ))
          )}
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
