"use client";

import { Badge } from "@obscura/ui/primitives/badge";
import { cn } from "@obscura/ui/lib/utils";
import { Check, ChevronDown, Library, Loader2, ScanSearch, X } from "lucide-react";
import { StatusDot, ToggleableField } from "../scrape/shared-components";
import { toApiUrl, acceptPluginResult } from "../../lib/api";
import type { AudioLibraryRow, AudioLibraryField } from "./types";

/* ─── Props ───────────────────────────────────────────────────── */

export interface AudioLibrariesTabProps {
  rows: AudioLibraryRow[];
  setRows: React.Dispatch<React.SetStateAction<AudioLibraryRow[]>>;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  onSeekSingle?: (idx: number) => void;
}

/* ─── Rows renderer ───────────────────────────────────────────── */

export function IdentifyAudioLibraryRows({
  rows,
  setRows,
  expandedIds,
  toggleExpanded,
  onSeekSingle,
}: AudioLibrariesTabProps) {
  function toggleField(idx: number, field: AudioLibraryField) {
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
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r)),
      );
    } catch {
      /* leave as found */
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

  return rows.map((row, idx) => (
    <AudioLibraryRowCard
      key={row.library.id}
      row={row}
      expanded={expandedIds.has(row.library.id)}
      onToggleExpand={() => toggleExpanded(row.library.id)}
      onToggleField={(field) => toggleField(idx, field)}
      onAccept={() => acceptRow(idx)}
      onDismiss={() => dismissRow(idx)}
      onSeekSingle={onSeekSingle ? () => onSeekSingle(idx) : undefined}
    />
  ));
}

/* ─── Row card ────────────────────────────────────────────────── */

function AudioLibraryRowCard({
  row,
  expanded,
  onToggleExpand,
  onToggleField,
  onAccept,
  onDismiss,
  onSeekSingle,
}: {
  row: AudioLibraryRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleField: (field: AudioLibraryField) => void;
  onAccept: () => void;
  onDismiss: () => void;
  onSeekSingle?: () => void;
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

        {row.library.coverImagePath ? (
          <img src={toApiUrl(row.library.coverImagePath)} alt="" className="w-10 h-10 object-cover flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 bg-surface-3 flex items-center justify-center flex-shrink-0">
            <Library className="h-4 w-4 text-text-disabled" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-[0.8rem] font-medium truncate">{row.library.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-text-disabled text-[0.65rem]">{row.library.trackCount} tracks</span>
            {row.matchedProvider && row.status !== "pending" && (
              <span className="text-text-disabled text-[0.6rem] font-mono">via {row.matchedProvider}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {(row.status === "pending" || row.status === "no-result" || row.status === "error") && onSeekSingle && (
            <button
              onClick={(e) => { e.stopPropagation(); onSeekSingle(); }}
              className="p-1.5 hover:bg-accent-950/60 text-text-muted hover:text-text-accent transition-colors"
              title="Identify this album"
            >
              <ScanSearch className="h-3.5 w-3.5" />
            </button>
          )}
          {row.status === "scraping" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-text-accent" />
          )}
          {row.status === "found" && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onAccept(); }}
                className="p-1.5 hover:bg-status-success/15 text-status-success-text transition-colors"
                title="Accept"
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

      {expanded && row.result && (
        <div className="surface-card no-lift ml-1 mr-1 mb-1 p-4 border-border-accent/20">
          <div className="flex gap-4">
            {row.result.imageUrl && (
              <img src={row.result.imageUrl} alt="" className="w-24 h-24 object-cover border border-border-subtle flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0 space-y-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {row.result.name && (
                  <ToggleableField field="title" label="Album" value={row.result.name} enabled={row.selectedFields.has("title")} onToggle={() => onToggleField("title")} />
                )}
                {row.result.artist && (
                  <ToggleableField field="performers" label="Artist" value={row.result.artist} enabled={row.selectedFields.has("performers")} onToggle={() => onToggleField("performers")} />
                )}
                {row.result.date && (
                  <ToggleableField field="date" label="Date" value={row.result.date} enabled={row.selectedFields.has("date")} onToggle={() => onToggleField("date")} />
                )}
                {row.result.urls.length > 0 && (
                  <ToggleableField field="url" label="URL" value={row.result.urls[0]} enabled={row.selectedFields.has("url")} onToggle={() => onToggleField("url")} />
                )}
              </div>
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

// Runners live in ./identify-runners.ts so the tab file stays focused
// on rendering. The Bulk Scrape page imports runAudioLibraryIdentify,
// acceptAllAudioLibraries, and seekAudioLibrarySingle from there.
