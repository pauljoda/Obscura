"use client";

import { useState } from "react";
import { Badge } from "@obscura/ui/primitives/badge";
import { cn } from "@obscura/ui/lib/utils";
import {
  Check,
  ChevronDown,
  Layers,
  Loader2,
  ScanSearch,
  X,
  FolderOpen,
} from "lucide-react";
import { StatusDot, ToggleableField } from "../scrape/shared-components";
import { executePlugin, acceptPluginResult } from "../../lib/api";
import {
  fetchVideoSeriesLibraryDetail,
  type VideoSeriesLibraryDetail,
} from "../../lib/api/videos";
import type { NormalizedScrapeResult } from "../scrape/types";
import type { VideoFolderRow, VideoFolderField, NormalizedFolderIdentifyResult } from "./types";
import { VIDEO_FOLDER_FIELDS } from "./types";
import { SEEK_TIMEOUT_MS, withTimeout } from "../scrape/types";
import { CascadeReviewDrawer } from "./cascade-review-drawer";

/* ─── Props ───────────────────────────────────────────────────── */

interface PluginInfo { id: string; name: string }

export interface VideoFoldersTabProps {
  rows: VideoFolderRow[];
  setRows: React.Dispatch<React.SetStateAction<VideoFolderRow[]>>;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  onSeekSingle?: (idx: number) => void;
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

/* ─── Local library → plugin input (TMDb cascade) ─────────────── */

function buildLocalSeasonsInput(detail: VideoSeriesLibraryDetail):
  | { localSeasons: Array<{ seasonNumber: number; episodes: Array<{
        episodeNumber: number;
        localFilePath: string;
        title: string | null;
      }> }> }
  | undefined {
  const seasons = detail.seasons
    .map((s) => ({
      seasonNumber: s.seasonNumber,
      episodes: s.episodes
        .filter((e) => e.episodeNumber != null)
        .map((e) => ({
          episodeNumber: e.episodeNumber!,
          localFilePath: e.filePath,
          title: e.title,
        })),
    }))
    .filter((s) => s.episodes.length > 0);
  return seasons.length ? { localSeasons: seasons } : undefined;
}

/* ─── Seek via plugin ─────────────────────────────────────────── */

async function seekFolderViaPlugin(
  row: VideoFolderRow,
  pluginList: PluginInfo[],
): Promise<{
  scrapeResultId?: string;
  folderResult?: NormalizedFolderIdentifyResult;
  matchedProvider?: string;
}> {
  for (const plugin of pluginList) {
    try {
      let pluginInput: Record<string, unknown> = {
        name: row.folder.displayTitle || row.folder.title,
        title: row.folder.displayTitle || row.folder.title,
      };
      try {
        const seriesLib = await fetchVideoSeriesLibraryDetail(row.folder.id);
        const extra = buildLocalSeasonsInput(seriesLib);
        if (extra) pluginInput = { ...pluginInput, ...extra };
      } catch {
        // Identify still works with series-only metadata when detail fetch fails.
      }

      const res = await withTimeout(
        executePlugin(plugin.id, "folderByName", pluginInput, {
          saveResult: true,
          entityId: row.folder.id,
        }),
        SEEK_TIMEOUT_MS * 6,
      );
      if (res.ok && res.result && res.normalized) {
        const savedRow = res.result as Record<string, unknown>;
        const rawResult = savedRow.rawResult as Record<string, unknown> | undefined;
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
          seasonCount: rawResult?.seasonCount as number | undefined,
          totalEpisodes: rawResult?.totalEpisodes as number | undefined,
        };
        return {
          scrapeResultId: savedRow.id as string,
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
      const { scrapeResultId, folderResult, matchedProvider } = await seekFolderViaPlugin(rows[i], pluginList);
      if (scrapeResultId && folderResult) {
        if (autoAccept) {
          try {
            await acceptPluginResult(scrapeResultId);
            setRows((prev) =>
              prev.map((r, idx) =>
                idx === i ? { ...r, status: "accepted" as const, result: folderResult, scrapeResultId, matchedProvider } : r,
              ),
            );
          } catch {
            setRows((prev) =>
              prev.map((r, idx) =>
                idx === i ? { ...r, status: "found" as const, result: folderResult, scrapeResultId, matchedProvider } : r,
              ),
            );
          }
        } else {
          setRows((prev) =>
            prev.map((r, idx) =>
              idx === i ? { ...r, status: "found" as const, result: folderResult, scrapeResultId, matchedProvider } : r,
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

/* ─── Single-row seek ─────────────────────────────────────────── */

export async function seekFolderSingle(
  idx: number,
  rows: VideoFolderRow[],
  setRows: React.Dispatch<React.SetStateAction<VideoFolderRow[]>>,
  pluginList: PluginInfo[],
) {
  const row = rows[idx];
  if (!row || row.status === "accepted" || row.status === "scraping") return;

  setRows((prev) =>
    prev.map((r, i) => (i === idx ? { ...r, status: "scraping" as const } : r)),
  );

  try {
    const { scrapeResultId, folderResult, matchedProvider } = await seekFolderViaPlugin(row, pluginList);
    if (folderResult) {
      setRows((prev) =>
        prev.map((r, i) =>
          i === idx ? { ...r, status: "found" as const, result: folderResult, scrapeResultId, matchedProvider } : r,
        ),
      );
    } else {
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "no-result" as const } : r)),
      );
    }
  } catch (err) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, status: "error" as const, error: err instanceof Error ? err.message : "Failed" } : r,
      ),
    );
  }
}

/* ─── Accept all ──────────────────────────────────────────────── */

export async function acceptAllVideoFolders(
  rows: VideoFolderRow[],
  setRows: React.Dispatch<React.SetStateAction<VideoFolderRow[]>>,
): Promise<void> {
  const found = rows
    .map((r, i) => ({ row: r, idx: i }))
    .filter(({ row }) => row.status === "found" && row.scrapeResultId);

  for (const { row, idx } of found) {
    try {
      await acceptPluginResult(row.scrapeResultId!, Array.from(row.selectedFields));
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "accepted" as const } : r)),
      );
    } catch { /* skip */ }
  }
}

/* ─── Rows renderer ───────────────────────────────────────────── */

export function IdentifyVideoFolderRows({
  rows,
  setRows,
  expandedIds,
  toggleExpanded,
  onSeekSingle,
}: VideoFoldersTabProps) {
  const [reviewing, setReviewing] = useState<{
    idx: number;
    scrapeResultId: string;
    label: string;
    seriesId: string;
  } | null>(null);

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

  return (
    <>
      {rows.map((row, idx) => (
        <VideoFolderRowCard
          key={row.folder.id}
          row={row}
          expanded={expandedIds.has(row.folder.id)}
          onToggleExpand={() => toggleExpanded(row.folder.id)}
          onToggleField={(field) => toggleField(idx, field)}
          onAccept={async () => {
            if (!row.scrapeResultId) return;
            try {
              await acceptPluginResult(
                row.scrapeResultId,
                Array.from(row.selectedFields),
              );
              setRows((prev) =>
                prev.map((r, i) =>
                  i === idx ? { ...r, status: "accepted" as const } : r,
                ),
              );
            } catch {
              /* keep as found */
            }
          }}
          onDismiss={() => {
            setRows((prev) =>
              prev.map((r, i) =>
                i === idx
                  ? {
                      ...r,
                      status: "pending" as const,
                      result: undefined,
                      scrapeResultId: undefined,
                      matchedProvider: undefined,
                      error: undefined,
                    }
                  : r,
              ),
            );
          }}
          onReview={
            row.scrapeResultId
              ? () =>
                  setReviewing({
                    idx,
                    scrapeResultId: row.scrapeResultId!,
                    label: row.folder.displayTitle || row.folder.title,
                    seriesId: row.folder.id,
                  })
              : undefined
          }
          onSeekSingle={onSeekSingle ? () => onSeekSingle(idx) : undefined}
        />
      ))}

      {reviewing && (
        <CascadeReviewDrawer
          scrapeResultId={reviewing.scrapeResultId}
          entityKind="video_series"
          entityId={reviewing.seriesId}
          label={reviewing.label}
          onAccepted={() => {
            setRows((prev) =>
              prev.map((r, i) =>
                i === reviewing.idx
                  ? { ...r, status: "accepted" as const }
                  : r,
              ),
            );
            setReviewing(null);
          }}
          onClose={() => setReviewing(null)}
        />
      )}
    </>
  );
}

/* ─── Row card ────────────────────────────────────────────────── */

function VideoFolderRowCard({
  row,
  expanded,
  onToggleExpand,
  onToggleField,
  onAccept,
  onDismiss,
  onReview,
  onSeekSingle,
}: {
  row: VideoFolderRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleField: (field: VideoFolderField) => void;
  onAccept: () => void;
  onDismiss: () => void;
  onReview?: () => void;
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

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {(row.status === "pending" || row.status === "no-result" || row.status === "error") && onSeekSingle && (
            <button
              onClick={(e) => { e.stopPropagation(); onSeekSingle(); }}
              className="p-1.5 hover:bg-accent-950/60 text-text-muted hover:text-text-accent transition-colors"
              title="Identify this folder"
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
                  title="Review cascade (seasons + episodes + images)"
                >
                  <Layers className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onAccept(); }}
                className="p-1.5 hover:bg-status-success/15 text-status-success-text transition-colors"
                title="Quick accept (legacy)"
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
