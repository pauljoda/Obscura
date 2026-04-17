"use client";

import { Badge } from "@obscura/ui/primitives/badge";
import { Checkbox } from "@obscura/ui/primitives/checkbox";
import { cn } from "@obscura/ui/lib/utils";
import { Check, ChevronDown, Loader2, Music, ScanSearch, X, Layers } from "lucide-react";
import { StatusDot, ToggleableField } from "../scrape/shared-components";
import { acceptPluginResult } from "../../lib/api";
import { revalidateLibraryCaches } from "../../app/actions/revalidate-library";
import type { AudioTrackRow, AudioTrackField } from "./types";
import { ReviewDrawer } from "./review-drawer";
import { useState } from "react";

/* ─── Props ───────────────────────────────────────────────────── */

export interface AudioTracksTabProps {
  rows: AudioTrackRow[];
  setRows: React.Dispatch<React.SetStateAction<AudioTrackRow[]>>;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  onSeekSingle?: (idx: number) => void;
}

/* ─── Rows renderer ───────────────────────────────────────────── */

export function IdentifyAudioTrackRows({
  rows,
  setRows,
  expandedIds,
  toggleExpanded,
  onSeekSingle,
}: AudioTracksTabProps) {
  const [reviewingIdx, setReviewingIdx] = useState<number | null>(null);

  function toggleField(idx: number, field: AudioTrackField) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = new Set(r.selectedFields);
        if (next.has(field)) next.delete(field);
        else next.add(field);
        return { ...r, selectedFields: next };
      }),
    );
  }

  async function acceptRow(idx: number) {
    const row = rows[idx];
    if (!row?.scrapeResultId) return;
    try {
      await acceptPluginResult(
        row.scrapeResultId,
        Array.from(row.selectedFields),
      );
      await revalidateLibraryCaches(["audio-libraries"]);
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r)),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Accept failed";
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "error", error: message } : r)),
      );
    }
  }

  function dismissRow(idx: number) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              status: "pending",
              result: undefined,
              scrapeResultId: undefined,
              matchedProvider: undefined,
              error: undefined,
            }
          : r,
      ),
    );
  }

  return (
    <>
      {rows.map((row, idx) => (
        <AudioTrackRowCard
          key={row.track.id}
          row={row}
          expanded={expandedIds.has(row.track.id)}
          onToggleExpand={() => toggleExpanded(row.track.id)}
          onToggleField={(field) => toggleField(idx, field)}
          onAccept={() => acceptRow(idx)}
          onDismiss={() => dismissRow(idx)}
          onReview={row.status === "found" ? () => setReviewingIdx(idx) : undefined}
          onSeekSingle={onSeekSingle ? () => onSeekSingle(idx) : undefined}
        />
      ))}
      {reviewingIdx !== null && (
        <AudioTrackReviewDrawer
          row={rows[reviewingIdx]}
          onClose={() => setReviewingIdx(null)}
          onToggleField={(field) => toggleField(reviewingIdx, field)}
          onAccept={async () => {
            await acceptRow(reviewingIdx);
            setReviewingIdx(null);
          }}
          onNext={
            reviewingIdx < rows.length - 1
              ? () => {
                  const nextIdx = reviewingIdx + 1;
                  if (rows[nextIdx].status === "found") {
                    setReviewingIdx(nextIdx);
                  } else {
                    setReviewingIdx(null);
                  }
                }
              : undefined
          }
          onPrev={
            reviewingIdx > 0
              ? () => {
                  const prevIdx = reviewingIdx - 1;
                  if (rows[prevIdx].status === "found") {
                    setReviewingIdx(prevIdx);
                  } else {
                    setReviewingIdx(null);
                  }
                }
              : undefined
          }
          hasNext={reviewingIdx < rows.length - 1 && rows[reviewingIdx + 1].status === "found"}
          hasPrev={reviewingIdx > 0 && rows[reviewingIdx - 1].status === "found"}
          onAcceptAndNext={async () => {
            await acceptRow(reviewingIdx);
            if (reviewingIdx < rows.length - 1) {
              const nextIdx = reviewingIdx + 1;
              if (rows[nextIdx].status === "found") {
                setReviewingIdx(nextIdx);
              } else {
                setReviewingIdx(null);
              }
            } else {
              setReviewingIdx(null);
            }
          }}
        />
      )}
    </>
  );
}

/* ─── Row card ────────────────────────────────────────────────── */

function AudioTrackRowCard({
  row,
  expanded,
  onToggleExpand,
  onToggleField,
  onAccept,
  onDismiss,
  onReview,
  onSeekSingle,
}: {
  row: AudioTrackRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleField: (field: AudioTrackField) => void;
  onAccept: () => void;
  onDismiss: () => void;
  onReview?: () => void;
  onSeekSingle?: () => void;
}) {
  return (
    <div>
      <div
        onClick={onReview || onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            if (onReview) onReview();
            else onToggleExpand();
          }
        }}
        className={cn(
          "w-full text-left surface-card no-lift p-3 flex items-center gap-3 transition-all duration-fast cursor-pointer",
          expanded && "border-border-accent/40",
          row.status === "accepted" && "opacity-50",
        )}
      >
        <StatusDot status={row.status} />

        <div className="w-10 h-10 bg-surface-3 flex items-center justify-center flex-shrink-0">
          <Music className="h-4 w-4 text-text-disabled" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[0.8rem] font-medium truncate">{row.track.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {row.track.embeddedArtist && (
              <span className="text-text-accent text-[0.65rem]">{row.track.embeddedArtist}</span>
            )}
            {row.track.embeddedAlbum && (
              <span className="text-text-disabled text-[0.65rem]">{row.track.embeddedAlbum}</span>
            )}
            {row.track.duration != null && (
              <span className="text-text-disabled text-[0.65rem]">{Math.floor(row.track.duration / 60)}:{String(Math.floor(row.track.duration % 60)).padStart(2, "0")}</span>
            )}
            {row.matchedProvider && row.status !== "pending" && (
              <span className="text-text-disabled text-[0.6rem] font-mono">via {row.matchedProvider}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {(row.status === "pending" || row.status === "no-result" || row.status === "error") && onSeekSingle && (
            <button
              onClick={(e) => { e.stopPropagation(); onSeekSingle(); }}
              className="p-1.5 hover:bg-accent-950/60 text-text-muted hover:text-text-accent transition-colors"
              title="Identify this track"
            >
              <ScanSearch className="h-3.5 w-3.5" />
            </button>
          )}
          {row.status === "scraping" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-text-accent" />
          )}
          {row.status === "found" && (
            <>
              {onReview && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReview();
                  }}
                  className="p-1.5 hover:bg-accent-950/60 text-text-muted hover:text-text-accent transition-colors"
                  title="Review match"
                >
                  <Layers className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onAccept(); }}
                className="p-1.5 hover:bg-status-success/15 text-status-success-text transition-colors"
                title="Quick accept"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                className="p-1.5 hover:bg-status-error/10 text-text-disabled hover:text-status-error-text transition-colors"
                title="Dismiss result"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {row.status === "accepted" && (
            <Badge variant="accent" className="text-[0.55rem]">Applied</Badge>
          )}
        </div>

        <ChevronDown
          className={cn(
            "h-3 w-3 text-text-disabled flex-shrink-0 transition-transform duration-fast",
            expanded && "rotate-180",
          )}
        />
      </div>

      {expanded && row.error && (
        <div className="surface-card no-lift ml-6 mr-1 mb-1 p-3 border-status-error/20">
          <p className="text-[0.7rem] text-status-error-text">{row.error}</p>
        </div>
      )}
    </div>
  );
}

function AudioTrackReviewDrawer({
  row,
  onClose,
  onToggleField,
  onAccept,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
  onAcceptAndNext,
}: {
  row: AudioTrackRow;
  onClose: () => void;
  onToggleField: (field: AudioTrackField) => void;
  onAccept: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  onAcceptAndNext?: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const footer = (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={async () => {
          setBusy(true);
          try {
            if (onAcceptAndNext) await onAcceptAndNext();
            else await onAccept();
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        className={cn(
          "surface-card px-4 py-1.5 text-[0.72rem] font-medium hover:border-border-accent",
          busy && "opacity-50 cursor-not-allowed",
        )}
      >
        {busy ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Applying…
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <Check className="h-3 w-3" /> {onAcceptAndNext ? "Accept & Next" : "Accept"}
          </span>
        )}
      </button>
    </div>
  );

  return (
    <ReviewDrawer
      label={row.track.title}
      onClose={onClose}
      onNext={onNext}
      onPrev={onPrev}
      hasNext={hasNext}
      hasPrev={hasPrev}
      footer={footer}
    >
      <div className="p-5 space-y-4">
        {row.result && (
          <div className="flex flex-col md:flex-row gap-4">
            {row.result.imageUrl && (
              <img src={row.result.imageUrl} alt="" className="w-24 h-24 object-cover border border-border-subtle flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0 space-y-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {row.result.title && (
                  <ToggleableField field="title" label="Title" value={row.result.title} enabled={row.selectedFields.has("title")} onToggle={() => onToggleField("title")} />
                )}
                {row.result.artist && (
                  <ToggleableField field="performers" label="Artist" value={row.result.artist} enabled={row.selectedFields.has("performers")} onToggle={() => onToggleField("performers")} />
                )}
                {row.result.album && (
                  <ToggleableField field="details" label="Album" value={row.result.album} enabled={row.selectedFields.has("details")} onToggle={() => onToggleField("details")} />
                )}
                {row.result.trackNumber != null && (
                  <ToggleableField field="trackNumber" label="Track #" value={String(row.result.trackNumber)} enabled={row.selectedFields.has("trackNumber")} onToggle={() => onToggleField("trackNumber")} />
                )}
                {row.result.date && (
                  <ToggleableField field="date" label="Date" value={row.result.date} enabled={row.selectedFields.has("date")} onToggle={() => onToggleField("date")} />
                )}
                {row.result.urls.length > 0 && (
                  <ToggleableField field="url" label="URL" value={row.result.urls[0]} enabled={row.selectedFields.has("url")} onToggle={() => onToggleField("url")} />
                )}
              </div>
              {row.result.tagNames.length > 0 && (
                <div className={cn("transition-opacity", !row.selectedFields.has("tags") && "opacity-40")}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Checkbox checked={row.selectedFields.has("tags")} onChange={() => onToggleField("tags")} />
                    <span className="text-kicker">Genre</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {row.result.tagNames.map((name) => (
                      <span key={name} className="tag-chip tag-chip-default">{name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ReviewDrawer>
  );
}

// Runners live in ./identify-runners.ts (runAudioTrackIdentify,
// acceptAllAudioTracks, seekAudioTrackSingle).
