"use client";

import { Badge } from "@obscura/ui/primitives/badge";
import { Checkbox } from "@obscura/ui/primitives/checkbox";
import { cn } from "@obscura/ui/lib/utils";
import { ChevronDown, Music } from "lucide-react";
import { StatusDot, ToggleableField } from "../scrape/shared-components";
import type { AudioTrackRow, AudioTrackField } from "./types";

/* ─── Props ───────────────────────────────────────────────────── */

export interface AudioTracksTabProps {
  rows: AudioTrackRow[];
  setRows: React.Dispatch<React.SetStateAction<AudioTrackRow[]>>;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
}

/* ─── Rows renderer ───────────────────────────────────────────── */

export function IdentifyAudioTrackRows({
  rows,
  setRows,
  expandedIds,
  toggleExpanded,
}: AudioTracksTabProps) {
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

  return rows.map((row, idx) => (
    <AudioTrackRowCard
      key={row.track.id}
      row={row}
      expanded={expandedIds.has(row.track.id)}
      onToggleExpand={() => toggleExpanded(row.track.id)}
      onToggleField={(field) => toggleField(idx, field)}
    />
  ));
}

/* ─── Row card ────────────────────────────────────────────────── */

function AudioTrackRowCard({
  row,
  expanded,
  onToggleExpand,
  onToggleField,
}: {
  row: AudioTrackRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleField: (field: AudioTrackField) => void;
}) {
  return (
    <div>
      <div
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggleExpand();
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

        {row.status === "accepted" && (
          <Badge variant="accent" className="text-[0.55rem] flex-shrink-0">Applied</Badge>
        )}

        <ChevronDown
          className={cn(
            "h-3 w-3 text-text-disabled flex-shrink-0 transition-transform duration-fast",
            expanded && "rotate-180",
          )}
        />
      </div>

      {expanded && row.result && (
        <div className="surface-card no-lift ml-1 mr-1 mb-1 p-4 border-border-accent/20">
          <div className="flex gap-4">
            {row.result.imageUrl && (
              <img src={row.result.imageUrl} alt="" className="w-16 h-16 object-cover border border-border-subtle flex-shrink-0" />
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
        </div>
      )}

      {expanded && row.error && (
        <div className="surface-card no-lift ml-6 mr-1 mb-1 p-3 border-status-error/20">
          <p className="text-[0.7rem] text-status-error-text">{row.error}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Scrape runner (placeholder) ─────────────────────────────── */

export async function runAudioTrackIdentify(): Promise<void> {}
export async function acceptAllAudioTracks(): Promise<void> {}
