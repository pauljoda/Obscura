"use client";

import { Badge } from "@obscura/ui/primitives/badge";
import { cn } from "@obscura/ui/lib/utils";
import { Check, ChevronDown, X, FolderOpen } from "lucide-react";
import { StatusDot, ToggleableField } from "../scrape/shared-components";
import { executePlugin, acceptScrapeResult, rejectScrapeResult } from "../../lib/api";
import type { ScrapeResult, NormalizedScrapeResult } from "../scrape/types";
import type { VideoFolderRow, VideoFolderField, NormalizedFolderIdentifyResult } from "./types";
import { VIDEO_FOLDER_FIELDS } from "./types";
import { SEEK_TIMEOUT_MS, withTimeout } from "../scrape/types";

/* ─── Props ───────────────────────────────────────────────────── */

interface PluginInfo { id: string; name: string }

export interface VideoFoldersTabProps {
  rows: VideoFolderRow[];
  setRows: React.Dispatch<React.SetStateAction<VideoFolderRow[]>>;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
}

export interface VideoFolderRunProps {
  rows: VideoFolderRow[];
  setRows: React.Dispatch<React.SetStateAction<VideoFolderRow[]>>;
  plugins: PluginInfo[];
  selectedProviderId: string;
  autoAccept: boolean;
  abortRef: React.RefObject<boolean>;
  setRunning: (running: boolean) => void;
}

/* ─── Seek via plugin ─────────────────────────────────────────── */

async function seekFolderViaPlugin(
  row: VideoFolderRow,
  pluginList: PluginInfo[],
): Promise<{
  result?: ScrapeResult;
  normalized?: NormalizedScrapeResult;
  folderResult?: NormalizedFolderIdentifyResult;
  matchedProvider?: string;
}> {
  for (const plugin of pluginList) {
    try {
      const res = await withTimeout(
        executePlugin(plugin.id, "folderByName", {
          name: row.folder.displayTitle || row.folder.title,
          title: row.folder.displayTitle || row.folder.title,
        }, {
          saveResult: true,
          entityId: row.folder.id,
        }),
        SEEK_TIMEOUT_MS * 2, // Give folder lookups a bit more time
      );
      if (res.ok && res.result && res.normalized) {
        // Also extract the full folder result from the raw plugin output
        const rawResult = (res.result as Record<string, unknown>).rawResult as Record<string, unknown> | undefined;
        const folderResult: NormalizedFolderIdentifyResult = {
          name: res.normalized.title,
          details: res.normalized.details,
          date: res.normalized.date,
          imageUrl: res.normalized.imageUrl,
          backdropUrl: (rawResult?.backdropUrl as string) ?? null,
          studioName: res.normalized.studioName,
          tagNames: res.normalized.tagNames ?? [],
          urls: rawResult?.urls as string[] ?? (res.normalized.url ? [res.normalized.url] : []),
          seriesExternalId: rawResult?.seriesExternalId as string | undefined,
          seasonNumber: rawResult?.seasonNumber as number | undefined,
          totalEpisodes: rawResult?.totalEpisodes as number | undefined,
        };
        return {
          result: res.result as ScrapeResult,
          normalized: res.normalized,
          folderResult,
          matchedProvider: plugin.name,
        };
      }
    } catch {
      // Timeout or error -- try next
    }
  }
  return {};
}

/* ─── Run identify ────────────────────────────────────────────── */

export async function runVideoFolderIdentify({
  rows,
  setRows,
  plugins,
  selectedProviderId,
  autoAccept,
  abortRef,
  setRunning,
}: VideoFolderRunProps): Promise<void> {
  setRunning(true);
  abortRef.current = false;

  const isPlugin = selectedProviderId.startsWith("plugin:");
  const realId = selectedProviderId.replace(/^plugin:/, "");

  const pluginList = isPlugin
    ? plugins.filter((p) => p.id === realId)
    : selectedProviderId === "" ? plugins : [];

  // Reset non-accepted rows
  setRows((prev) =>
    prev.map((r) =>
      r.status === "accepted" ? r : { ...r, status: "pending" as const, result: undefined, error: undefined, matchedProvider: undefined },
    ),
  );

  for (let i = 0; i < rows.length; i++) {
    if (abortRef.current) break;
    if (rows[i].status === "accepted") continue;

    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, status: "scraping" as const } : r)),
    );

    try {
      const { result, folderResult, matchedProvider } = await seekFolderViaPlugin(rows[i], pluginList);
      if (result && folderResult) {
        if (autoAccept && result.id) {
          try {
            await acceptScrapeResult(result.id);
            setRows((prev) =>
              prev.map((r, idx) =>
                idx === i ? { ...r, status: "accepted" as const, result: folderResult, matchedProvider } : r,
              ),
            );
          } catch {
            setRows((prev) =>
              prev.map((r, idx) =>
                idx === i ? { ...r, status: "found" as const, result: folderResult, matchedProvider } : r,
              ),
            );
          }
        } else {
          setRows((prev) =>
            prev.map((r, idx) =>
              idx === i ? { ...r, status: "found" as const, result: folderResult, matchedProvider } : r,
            ),
          );
        }
      } else {
        setRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "no-result" as const } : r)),
        );
      }
    } catch (err) {
      setRows((prev) =>
        prev.map((r, idx) =>
          idx === i ? { ...r, status: "error" as const, error: err instanceof Error ? err.message : "Failed" } : r,
        ),
      );
    }
  }
  setRunning(false);
}

/* ─── Accept all ──────────────────────────────────────────────── */

export async function acceptAllVideoFolders(
  rows: VideoFolderRow[],
  _setRows: React.Dispatch<React.SetStateAction<VideoFolderRow[]>>,
): Promise<void> {
  // For now, folder accept requires the scrape_result ID — we'd need to store it on the row
  // This will be implemented with the full folder metadata apply logic
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
              {row.folder.directSceneCount} video{row.folder.directSceneCount !== 1 ? "s" : ""}
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
                    label="First Aired"
                    value={row.result.date}
                    enabled={row.selectedFields.has("date")}
                    onToggle={() => onToggleField("date")}
                  />
                )}
                {row.result.studioName && (
                  <ToggleableField
                    field="studio"
                    label="Network"
                    value={row.result.studioName}
                    enabled={row.selectedFields.has("studio")}
                    onToggle={() => onToggleField("studio")}
                  />
                )}
                {row.result.urls.length > 0 && (
                  <ToggleableField
                    field="url"
                    label="URL"
                    value={row.result.urls[0]}
                    enabled={row.selectedFields.has("url")}
                    onToggle={() => onToggleField("url")}
                  />
                )}
              </div>
              {row.result.details && (
                <div className="text-[0.72rem] text-text-muted line-clamp-3">
                  {row.result.details}
                </div>
              )}
              {row.result.tagNames.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {row.result.tagNames.map((tag) => (
                    <span key={tag} className="tag-chip tag-chip-default text-[0.55rem]">{tag}</span>
                  ))}
                </div>
              )}

              {/* Series info */}
              {row.result.seriesExternalId && (
                <div className="flex items-center gap-2 pt-1 text-[0.65rem] text-text-disabled font-mono">
                  {row.result.seriesExternalId}
                  {row.result.totalEpisodes != null && (
                    <span> · {row.result.totalEpisodes} episodes</span>
                  )}
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
