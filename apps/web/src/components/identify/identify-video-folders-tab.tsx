"use client";

import { Badge } from "@obscura/ui/primitives/badge";
import { cn } from "@obscura/ui/lib/utils";
import { Check, ChevronDown, X, FolderOpen } from "lucide-react";
import { StatusDot, ToggleableField } from "../scrape/shared-components";
import type { VideoFolderRow, VideoFolderField } from "./types";
import { VIDEO_FOLDER_FIELDS } from "./types";

/* ─── Props ───────────────────────────────────────────────────── */

export interface VideoFoldersTabProps {
  rows: VideoFolderRow[];
  setRows: React.Dispatch<React.SetStateAction<VideoFolderRow[]>>;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
}

/* ─── Rows renderer ───────────────────────────────────────────── */

export function IdentifyVideoFolderRows({
  rows,
  setRows,
  expandedIds,
  toggleExpanded,
}: VideoFoldersTabProps) {
  function toggleField(idx: number, field: VideoFolderField) {
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
    <VideoFolderRowCard
      key={row.folder.id}
      row={row}
      expanded={expandedIds.has(row.folder.id)}
      onToggleExpand={() => toggleExpanded(row.folder.id)}
      onToggleField={(field) => toggleField(idx, field)}
    />
  ));
}

/* ─── Row card ────────────────────────────────────────────────── */

function VideoFolderRowCard({
  row,
  expanded,
  onToggleExpand,
  onToggleField,
}: {
  row: VideoFolderRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleField: (field: VideoFolderField) => void;
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
          row.status === "rejected" && "opacity-30",
        )}
      >
        <StatusDot status={row.status} />

        <FolderOpen className="h-5 w-5 text-text-muted flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="text-[0.8rem] font-medium truncate">
            {row.folder.displayTitle}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-text-disabled text-[0.65rem]">
              {row.folder.directSceneCount} videos
            </span>
            {row.folder.studioName && (
              <span className="text-text-accent text-[0.65rem]">
                {row.folder.studioName}
              </span>
            )}
            {row.matchedProvider && row.status !== "pending" && (
              <span className="text-text-disabled text-[0.6rem] font-mono">
                via {row.matchedProvider}
              </span>
            )}
          </div>
        </div>

        {row.status === "accepted" && (
          <Badge variant="accent" className="text-[0.55rem] flex-shrink-0">
            Applied
          </Badge>
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
              <div className="flex-shrink-0">
                <img
                  src={row.result.imageUrl}
                  alt=""
                  className="w-28 h-40 object-cover border border-border-subtle"
                />
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {row.result.name && (
                  <ToggleableField
                    field="title"
                    label="Series Title"
                    value={row.result.name}
                    enabled={row.selectedFields.has("title")}
                    onToggle={() => onToggleField("title")}
                  />
                )}
                {row.result.date && (
                  <ToggleableField
                    field="date"
                    label="Date"
                    value={row.result.date}
                    enabled={row.selectedFields.has("date")}
                    onToggle={() => onToggleField("date")}
                  />
                )}
                {row.result.studioName && (
                  <ToggleableField
                    field="studio"
                    label="Studio / Network"
                    value={row.result.studioName}
                    enabled={row.selectedFields.has("studio")}
                    onToggle={() => onToggleField("studio")}
                  />
                )}
                {row.result.seasonNumber != null && (
                  <ToggleableField
                    field="seasonNumber"
                    label="Season"
                    value={String(row.result.seasonNumber)}
                    enabled={row.selectedFields.has("seasonNumber")}
                    onToggle={() => onToggleField("seasonNumber")}
                  />
                )}
              </div>
              {row.result.details && (
                <div className="text-[0.72rem] text-text-muted line-clamp-3">
                  {row.result.details}
                </div>
              )}

              {/* Episode cascade button placeholder */}
              {row.result.seriesExternalId && row.wizardStep === "idle" && (
                <div className="pt-2">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-accent border border-border-accent/40 hover:bg-accent-950/50 transition-all">
                    Cascade to episodes ({row.result.totalEpisodes ?? "?"})
                  </button>
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

export async function runVideoFolderIdentify(
  _props: { rows: VideoFolderRow[] },
): Promise<void> {
  // Will be implemented when plugin execution is wired
}

export async function acceptAllVideoFolders(
  _rows: VideoFolderRow[],
  _setRows: React.Dispatch<React.SetStateAction<VideoFolderRow[]>>,
): Promise<void> {
  // Will be implemented when plugin execution is wired
}
