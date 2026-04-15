"use client";

/**
 * Generic multi-candidate image picker for the cascade review flow.
 *
 * Consumes a `ImageCandidate[]` (as produced by plugins during the
 * seek phase) and renders:
 *
 *   1. A compact preview chip showing the currently-selected image
 *      (or a "No image" placeholder). Click opens the modal.
 *   2. A modal grid of all candidates at thumbnail resolution, with
 *      language / dimension / rank badges. Selection calls back via
 *      `onSelect` with the picked URL (or `null` to clear).
 *
 * The picker is deliberately controlled: the parent (cascade review
 * drawer) owns the selected URL so it can persist the choice into
 * the `CascadeAcceptSpec` payload. When `value` is undefined and
 * `candidates[0]` exists, the first candidate is shown as the
 * implicit default — matching the server rule "unset slots default
 * to the first candidate during accept."
 */

import { useState } from "react";
import type { ImageCandidate } from "@obscura/contracts";
import { cn } from "@obscura/ui/lib/utils";
import { Check, Image as ImageIcon, X } from "lucide-react";

/* ─── Preview chip ───────────────────────────────────────────────── */

export interface ImagePickerProps {
  /** Image slot label ("Poster", "Backdrop", "Still", etc.). */
  label: string;
  candidates: ImageCandidate[];
  /**
   * Currently-selected URL. `undefined` means "unset — use the first
   * candidate." `null` means "explicitly no image."
   */
  value: string | null | undefined;
  onSelect: (url: string | null) => void;
  /** Aspect ratio class for the preview chip. Defaults to 2:3 (poster). */
  aspect?: "poster" | "backdrop" | "still" | "logo";
  className?: string;
}

const ASPECT_CLASS: Record<NonNullable<ImagePickerProps["aspect"]>, string> = {
  poster: "aspect-[2/3]",
  backdrop: "aspect-[16/9]",
  still: "aspect-[16/9]",
  logo: "aspect-[16/5]",
};

export function ImagePicker({
  label,
  candidates,
  value,
  onSelect,
  aspect = "poster",
  className,
}: ImagePickerProps) {
  const [open, setOpen] = useState(false);

  const effectiveUrl =
    value === null
      ? null
      : (value ?? candidates[0]?.url ?? null);

  const aspectClass = ASPECT_CLASS[aspect];

  return (
    <>
      <div className={cn("space-y-1", className)}>
        <div className="text-[0.62rem] uppercase tracking-[0.14em] text-text-muted">
          {label}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={candidates.length === 0}
          className={cn(
            "group relative w-full overflow-hidden border border-border-subtle bg-surface-2 transition-colors duration-fast",
            candidates.length > 0
              ? "hover:border-border-accent cursor-pointer"
              : "opacity-50 cursor-not-allowed",
            aspectClass,
          )}
          title={
            candidates.length === 0
              ? "No candidates available"
              : `Choose ${label.toLowerCase()} (${candidates.length} available)`
          }
        >
          {effectiveUrl ? (
            <img
              src={effectiveUrl}
              alt={label}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-text-disabled">
              <ImageIcon className="h-6 w-6" />
              <span className="text-[0.6rem]">
                {candidates.length === 0 ? "None" : "No image"}
              </span>
            </div>
          )}
          {candidates.length > 1 && (
            <div className="absolute right-1 top-1 bg-surface-3/90 px-1 py-0.5 text-[0.55rem] font-mono text-text-muted">
              {candidates.length}
            </div>
          )}
        </button>
      </div>

      {open && (
        <ImagePickerModal
          label={label}
          candidates={candidates}
          value={value}
          aspect={aspect}
          onClose={() => setOpen(false)}
          onSelect={(url) => {
            onSelect(url);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

/* ─── Modal ──────────────────────────────────────────────────────── */

function ImagePickerModal({
  label,
  candidates,
  value,
  aspect,
  onClose,
  onSelect,
}: {
  label: string;
  candidates: ImageCandidate[];
  value: string | null | undefined;
  aspect: NonNullable<ImagePickerProps["aspect"]>;
  onClose: () => void;
  onSelect: (url: string | null) => void;
}) {
  const [sortBy, setSortBy] = useState<"rank" | "resolution" | "language">(
    "rank",
  );
  const [languageFilter, setLanguageFilter] = useState<string>("");
  const [hideLanguageless, setHideLanguageless] = useState(false);

  const languages = Array.from(
    new Set(
      candidates
        .map((c) => c.language)
        .filter((l): l is string => typeof l === "string" && l.length > 0),
    ),
  ).sort();

  const filtered = candidates.filter((c) => {
    if (languageFilter && c.language !== languageFilter) return false;
    if (hideLanguageless && !c.language) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "rank") {
      const ar = a.rank ?? 0;
      const br = b.rank ?? 0;
      if (br !== ar) return br - ar;
    }
    if (sortBy === "resolution") {
      const ap = (a.width ?? 0) * (a.height ?? 0);
      const bp = (b.width ?? 0) * (b.height ?? 0);
      if (bp !== ap) return bp - ap;
    }
    if (sortBy === "language") {
      const al = a.language ?? "";
      const bl = b.language ?? "";
      if (al !== bl) return al.localeCompare(bl);
    }
    return 0;
  });

  const selectedUrl = value === null ? null : (value ?? candidates[0]?.url ?? null);
  const aspectClass = ASPECT_CLASS[aspect];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/80 backdrop-blur"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-1 flex max-h-[90vh] w-full max-w-5xl flex-col border border-border-subtle shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-3">
          <h3 className="text-base font-semibold text-text-primary">
            Choose {label.toLowerCase()}
            <span className="ml-2 text-[0.7rem] font-normal text-text-muted">
              {filtered.length} of {candidates.length}
            </span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle px-5 py-2 text-[0.7rem]">
          <label className="flex items-center gap-1.5">
            <span className="text-text-muted">Sort</span>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "rank" | "resolution" | "language")
              }
              className="surface-card no-lift border border-border-subtle bg-surface-2 px-1.5 py-0.5 text-[0.7rem] text-text-primary"
            >
              <option value="rank">Rank</option>
              <option value="resolution">Resolution</option>
              <option value="language">Language</option>
            </select>
          </label>

          {languages.length > 0 && (
            <label className="flex items-center gap-1.5">
              <span className="text-text-muted">Language</span>
              <select
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                className="surface-card no-lift border border-border-subtle bg-surface-2 px-1.5 py-0.5 text-[0.7rem] text-text-primary"
              >
                <option value="">Any</option>
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={hideLanguageless}
              onChange={(e) => setHideLanguageless(e.target.checked)}
              className="h-3 w-3"
            />
            <span className="text-text-muted">Hide language-agnostic</span>
          </label>

          <button
            type="button"
            onClick={() => onSelect(null)}
            className={cn(
              "ml-auto px-2 py-1 text-[0.65rem] border transition-colors",
              selectedUrl === null
                ? "border-status-error/60 bg-status-error/10 text-status-error-text"
                : "border-border-subtle text-text-muted hover:border-status-error/40 hover:text-status-error-text",
            )}
          >
            Use no image
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {sorted.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-[0.72rem] text-text-muted">
              No candidates match the current filters.
            </div>
          ) : (
            <div
              className={cn(
                "grid gap-3",
                aspect === "poster"
                  ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
                  : "grid-cols-2 sm:grid-cols-3",
              )}
            >
              {sorted.map((candidate) => {
                const isSelected = candidate.url === selectedUrl;
                return (
                  <button
                    key={candidate.url}
                    type="button"
                    onClick={() => onSelect(candidate.url)}
                    className={cn(
                      "group relative overflow-hidden border transition-colors duration-fast",
                      isSelected
                        ? "border-border-accent"
                        : "border-border-subtle hover:border-border-accent/60",
                    )}
                    title={`${candidate.width ?? "?"}×${candidate.height ?? "?"}`}
                  >
                    <div className={cn("bg-surface-2", aspectClass)}>
                      <img
                        src={candidate.url}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </div>
                    {isSelected && (
                      <div className="absolute right-1 top-1 bg-accent-500 p-0.5 text-bg">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-bg/70 px-1 py-0.5 text-[0.55rem] font-mono text-text-muted">
                      <span>
                        {candidate.width && candidate.height
                          ? `${candidate.width}×${candidate.height}`
                          : "—"}
                      </span>
                      <span>
                        {candidate.language ?? "—"}
                        {candidate.rank !== undefined
                          ? ` · ${candidate.rank.toFixed(1)}`
                          : ""}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-5 py-3">
          <div className="text-[0.65rem] text-text-muted">
            Currently selected:{" "}
            <span className="text-text-primary">
              {selectedUrl === null
                ? "none"
                : selectedUrl
                  ? selectedUrl.split("/").pop()
                  : "(default)"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="surface-card px-3 py-1 text-[0.7rem] hover:border-border-accent"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
