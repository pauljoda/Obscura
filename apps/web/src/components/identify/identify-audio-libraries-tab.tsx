"use client";

import { Badge } from "@obscura/ui/primitives/badge";
import { Checkbox } from "@obscura/ui/primitives/checkbox";
import { cn } from "@obscura/ui/lib/utils";
import { ChevronDown, Library } from "lucide-react";
import { StatusDot, ToggleableField } from "../scrape/shared-components";
import { entityTerms } from "../../lib/terminology";
import { toApiUrl } from "../../lib/api";
import type { AudioLibraryRow, AudioLibraryField } from "./types";

/* ─── Props ───────────────────────────────────────────────────── */

export interface AudioLibrariesTabProps {
  rows: AudioLibraryRow[];
  setRows: React.Dispatch<React.SetStateAction<AudioLibraryRow[]>>;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
}

/* ─── Rows renderer ───────────────────────────────────────────── */

export function IdentifyAudioLibraryRows({
  rows,
  setRows,
  expandedIds,
  toggleExpanded,
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

  return rows.map((row, idx) => (
    <AudioLibraryRowCard
      key={row.library.id}
      row={row}
      expanded={expandedIds.has(row.library.id)}
      onToggleExpand={() => toggleExpanded(row.library.id)}
      onToggleField={(field) => toggleField(idx, field)}
    />
  ));
}

/* ─── Row card ────────────────────────────────────────────────── */

function AudioLibraryRowCard({
  row,
  expanded,
  onToggleExpand,
  onToggleField,
}: {
  row: AudioLibraryRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleField: (field: AudioLibraryField) => void;
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

/* ─── Scrape runner (placeholder) ─────────────────────────────── */

export async function runAudioLibraryIdentify(): Promise<void> {}
export async function acceptAllAudioLibraries(): Promise<void> {}
