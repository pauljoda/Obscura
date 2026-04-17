"use client";

import { useState } from "react";
import { Badge } from "@obscura/ui/primitives/badge";
import { Checkbox } from "@obscura/ui/primitives/checkbox";
import { cn } from "@obscura/ui/lib/utils";
import { Check, X, ChevronDown, ScanSearch, Loader2 } from "lucide-react";
import {
  scrapeVideo,
  identifyViaStashBox,
  acceptScrapeResult,
  rejectScrapeResult,
  executePlugin,
  toApiUrl,
} from "../../lib/api";
import { entityTerms } from "../../lib/terminology";
import { StatusDot, ToggleableField } from "./shared-components";
import type {
  VideoRow,
  VideoField,
  ScraperPackage,
  StashBoxEndpoint,
  ScrapeResult,
  NormalizedScrapeResult,
  TabSharedProps,
} from "./types";
import { VIDEO_FIELDS, SEEK_TIMEOUT_MS, withTimeout } from "./types";

/* ─── Props ───────────────────────────────────────────────────── */

export interface VideosTabProps extends TabSharedProps {
  videoRows: VideoRow[];
  setVideoRows: React.Dispatch<React.SetStateAction<VideoRow[]>>;
  videoScrapers: ScraperPackage[];
  plugins?: PluginInfo[];
}

/* ─── Seek helpers ────────────────────────────────────────────── */

async function seekVideoViaStashBox(row: VideoRow, endpoints: StashBoxEndpoint[]): Promise<{
  result?: ScrapeResult;
  normalized?: NormalizedScrapeResult;
  matchedScraper?: string;
  matchType?: string;
}> {
  for (const ep of endpoints) {
    try {
      const res = await withTimeout(
        identifyViaStashBox(ep.id, row.video.id),
        SEEK_TIMEOUT_MS
      );
      if (res.result && res.normalized) {
        return {
          result: res.result,
          normalized: res.normalized,
          matchedScraper: `${ep.name}${res.matchType === "fingerprint" ? " (fingerprint)" : ""}`,
          matchType: res.matchType,
        };
      }
    } catch {
      // Timeout or error -- try next
    }
  }
  return {};
}

interface PluginInfo { id: string; name: string }

async function seekVideoViaPlugin(
  row: VideoRow,
  pluginList: PluginInfo[],
): Promise<{ result?: ScrapeResult; normalized?: NormalizedScrapeResult; matchedScraper?: string }> {
  for (const plugin of pluginList) {
    try {
      // Try videoByName with the current video title.
      const res = await withTimeout(
        executePlugin(plugin.id, "videoByName", {
          name: row.video.title,
          title: row.video.title,
        }, {
          saveResult: true,
          entityId: row.video.id,
        }),
        SEEK_TIMEOUT_MS,
      );
      if (res.result && res.normalized) {
        return {
          result: res.result as ScrapeResult,
          normalized: res.normalized,
          matchedScraper: plugin.name,
        };
      }
    } catch {
      // Timeout or error -- try next
    }
  }
  return {};
}

async function seekVideo(
  row: VideoRow,
  scraperList: ScraperPackage[],
  sbEndpoints: StashBoxEndpoint[],
  pluginList: PluginInfo[] = [],
): Promise<{
  result?: ScrapeResult;
  normalized?: NormalizedScrapeResult;
  matchedScraper?: string;
  matchType?: string;
}> {
  // Try StashBox endpoints first (fingerprint matching is highest confidence)
  if (sbEndpoints.length > 0) {
    const sbResult = await seekVideoViaStashBox(row, sbEndpoints);
    if (sbResult.result) return sbResult;
  }

  // Try Obscura plugins
  if (pluginList.length > 0) {
    const pluginResult = await seekVideoViaPlugin(row, pluginList);
    if (pluginResult.result) return pluginResult;
  }

  // Fall back to community scrapers
  for (const scraper of scraperList) {
    try {
      const res = await withTimeout(
        scrapeVideo(scraper.id, row.video.id, "auto"),
        SEEK_TIMEOUT_MS
      );
      if (res.result && res.normalized) {
        return { result: res.result, normalized: res.normalized, matchedScraper: scraper.name };
      }
    } catch {
      // Timeout or error -- try next
    }
  }
  return {};
}

/* ─── Tab component ───────────────────────────────────────────── */

export function ScrapeVideoRows({
  videoRows,
  setVideoRows,
  expandedIds,
  toggleExpanded,
  onSeekSingle,
}: Pick<VideosTabProps, "videoRows" | "setVideoRows" | "expandedIds" | "toggleExpanded"> & {
  onSeekSingle?: (idx: number) => void;
}) {
  function toggleVideoField(idx: number, field: VideoField) {
    setVideoRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = new Set(r.selectedFields);
        if (next.has(field)) next.delete(field);
        else next.add(field);
        return { ...r, selectedFields: next };
      })
    );
  }

  function toggleVideoExcludePerformer(idx: number, name: string) {
    setVideoRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = new Set(r.excludedPerformers);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return { ...r, excludedPerformers: next };
      })
    );
  }

  function toggleVideoExcludeTag(idx: number, name: string) {
    setVideoRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = new Set(r.excludedTags);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return { ...r, excludedTags: next };
      })
    );
  }

  return videoRows.map((row, idx) => (
    <VideoRowCard
      key={row.video.id}
      row={row}
      expanded={expandedIds.has(row.video.id)}
      onToggleExpand={() => toggleExpanded(row.video.id)}
      onAccept={() => void acceptVideoRow(videoRows, idx, setVideoRows)}
      onReject={() => void rejectVideoRow(videoRows, idx, setVideoRows)}
      onDismiss={() => {
        setVideoRows((prev) =>
          prev.map((r, i) => (i === idx ? { ...r, status: "pending", result: undefined, normalized: undefined, matchedScraper: undefined, error: undefined } : r))
        );
      }}
      onSeekSingle={onSeekSingle ? () => onSeekSingle(idx) : undefined}
      onToggleField={(field) => toggleVideoField(idx, field)}
      onTogglePerformer={(name) => toggleVideoExcludePerformer(idx, name)}
      onToggleTag={(name) => toggleVideoExcludeTag(idx, name)}
    />
  ));
}

/* ─── Scrape runner ───────────────────────────────────────────── */

export async function runVideoScrape({
  videoRows,
  setVideoRows,
  videoScrapers,
  stashBoxEndpoints,
  selectedScraperId,
  autoAccept,
  abortRef,
  setRunning,
  plugins = [],
}: VideosTabProps) {
  setRunning(true);
  abortRef.current = false;

  const isStashBox = selectedScraperId.startsWith("stashbox:");
  const isScraper = selectedScraperId.startsWith("scraper:");
  const isPlugin = selectedScraperId.startsWith("plugin:");
  const realId = selectedScraperId.replace(/^(stashbox|scraper|plugin):/, "");

  const scraperList = isScraper
    ? videoScrapers.filter((s) => s.id === realId)
    : selectedScraperId === "" ? videoScrapers : [];
  const sbEndpoints = isStashBox
    ? stashBoxEndpoints.filter((e) => e.id === realId)
    : selectedScraperId === "" ? stashBoxEndpoints : [];
  const pluginList = isPlugin
    ? plugins.filter((p) => p.id === realId)
    : selectedScraperId === "" ? plugins : [];

  // Reset non-accepted rows
  setVideoRows((prev) =>
    prev.map((r) =>
      r.status === "accepted" ? r : { ...r, status: "pending", result: undefined, normalized: undefined, error: undefined }
    )
  );

  for (let i = 0; i < videoRows.length; i++) {
    if (abortRef.current) break;
    if (videoRows[i].status === "accepted") continue;

    setVideoRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, status: "scraping" } : r))
    );

    try {
      const { result, normalized, matchedScraper } = await seekVideo(videoRows[i], scraperList, sbEndpoints, pluginList);
      if (result && normalized) {
        if (autoAccept) {
          try {
            await acceptScrapeResult(result.id);
            setVideoRows((prev) =>
              prev.map((r, idx) =>
                idx === i ? { ...r, status: "accepted", result, normalized, matchedScraper } : r
              )
            );
          } catch {
            setVideoRows((prev) =>
              prev.map((r, idx) =>
                idx === i ? { ...r, status: "found", result, normalized, matchedScraper } : r
              )
            );
          }
        } else {
          setVideoRows((prev) =>
            prev.map((r, idx) =>
              idx === i ? { ...r, status: "found", result, normalized, matchedScraper } : r
            )
          );
        }
      } else {
        setVideoRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "no-result" } : r))
        );
      }
    } catch (err) {
      setVideoRows((prev) =>
        prev.map((r, idx) =>
          idx === i ? { ...r, status: "error", error: err instanceof Error ? err.message : "Failed" } : r
        )
      );
    }
  }
  setRunning(false);
}

/* ─── Single-row seek ─────────────────────────────────────────── */

export async function seekVideoSingle(
  idx: number,
  videoRows: VideoRow[],
  setVideoRows: React.Dispatch<React.SetStateAction<VideoRow[]>>,
  scraperList: ScraperPackage[],
  sbEndpoints: StashBoxEndpoint[],
  pluginList: PluginInfo[] = [],
) {
  const row = videoRows[idx];
  if (!row || row.status === "accepted" || row.status === "scraping") return;

  setVideoRows((prev) =>
    prev.map((r, i) => (i === idx ? { ...r, status: "scraping" } : r))
  );

  try {
    const { result, normalized, matchedScraper } = await seekVideo(row, scraperList, sbEndpoints, pluginList);
    if (result && normalized) {
      setVideoRows((prev) =>
        prev.map((r, i) =>
          i === idx ? { ...r, status: "found", result, normalized, matchedScraper } : r
        )
      );
    } else {
      setVideoRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "no-result" } : r))
      );
    }
  } catch (err) {
    setVideoRows((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, status: "error", error: err instanceof Error ? err.message : "Failed" } : r
      )
    );
  }
}

/* ─── Accept / Reject helpers ─────────────────────────────────── */

async function acceptVideoRow(
  videoRows: VideoRow[],
  idx: number,
  setVideoRows: React.Dispatch<React.SetStateAction<VideoRow[]>>
) {
  const row = videoRows[idx];
  if (!row.result) return;
  try {
    await acceptScrapeResult(row.result.id, Array.from(row.selectedFields), {
      excludePerformers: Array.from(row.excludedPerformers),
      excludeTags: Array.from(row.excludedTags),
    });
    setVideoRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r))
    );
  } catch { /* keep as found */ }
}

async function rejectVideoRow(
  videoRows: VideoRow[],
  idx: number,
  setVideoRows: React.Dispatch<React.SetStateAction<VideoRow[]>>
) {
  const row = videoRows[idx];
  if (!row.result) return;
  try {
    await rejectScrapeResult(row.result.id);
    setVideoRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, status: "rejected", result: undefined, normalized: undefined } : r))
    );
  } catch { /* ignore */ }
}

export async function acceptAllVideos(
  videoRows: VideoRow[],
  setVideoRows: React.Dispatch<React.SetStateAction<VideoRow[]>>
) {
  const found = videoRows.map((r, i) => ({ row: r, idx: i })).filter(({ row }) => row.status === "found" && row.result);
  for (const { row, idx } of found) {
    try {
      await acceptScrapeResult(row.result!.id);
      setVideoRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r))
      );
    } catch { /* skip */ }
  }
}

/* ─── Video row card ──────────────────────────────────────────── */

function VideoRowCard({
  row,
  expanded,
  onToggleExpand,
  onAccept,
  onReject,
  onDismiss,
  onSeekSingle,
  onToggleField,
  onTogglePerformer,
  onToggleTag,
}: {
  row: VideoRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onAccept: () => void;
  onReject: () => void;
  onDismiss: () => void;
  onSeekSingle?: () => void;
  onToggleField: (field: VideoField) => void;
  onTogglePerformer: (name: string) => void;
  onToggleTag: (name: string) => void;
}) {
  return (
    <div>
      <div
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleExpand(); }}
        className={cn(
          "w-full text-left surface-card no-lift p-3 flex items-center gap-3 transition-all duration-fast cursor-pointer",
          expanded && "border-border-accent/40",
          row.status === "accepted" && "opacity-50",
          row.status === "rejected" && "opacity-30"
        )}
      >
        <StatusDot status={row.status} />

        {/* Thumbnail */}
        {row.video.thumbnailPath ? (
          <img
            src={toApiUrl(row.video.thumbnailPath)}
            alt=""
            className="w-16 h-10 object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-10 bg-surface-3 flex-shrink-0" />
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[0.8rem] font-medium truncate">{row.video.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-text-disabled text-[0.65rem]">{row.video.durationFormatted ?? "\u2014"}</span>
            {row.video.resolution && (
              <span className="pill-accent px-1 py-0 text-[0.55rem]">{row.video.resolution}</span>
            )}
            {row.normalized?.studioName && (
              <span className="text-text-accent text-[0.65rem]">{row.normalized.studioName}</span>
            )}
            {row.matchedScraper && row.status !== "pending" && (
              <span className="text-text-disabled text-[0.6rem] font-mono">via {row.matchedScraper}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Identify single row */}
          {(row.status === "pending" || row.status === "no-result" || row.status === "error") && onSeekSingle && (
            <button
              onClick={(e) => { e.stopPropagation(); onSeekSingle(); }}
              className="p-1.5 hover:bg-accent-950/60 text-text-muted hover:text-text-accent transition-colors"
              title="Identify this item"
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
            expanded && "rotate-180"
          )}
        />
      </div>

      {/* Expanded detail */}
      {expanded && row.normalized && (
        <div className="surface-card no-lift ml-1 mr-1 mb-1 p-4 border-border-accent/20">
          <div className="flex gap-4">
            {/* Large thumbnail on left */}
            {row.normalized.imageUrl && (
              <div
                className={cn(
                  "flex-shrink-0 cursor-pointer transition-opacity",
                  !row.selectedFields.has("image") && "opacity-40"
                )}
                onClick={(e) => { e.stopPropagation(); onToggleField("image"); }}
              >
                <div className="relative">
                  <img
                    src={row.normalized.imageUrl}
                    alt=""
                    className={cn(
                      "w-40 h-24 object-cover border transition-all",
                      row.selectedFields.has("image")
                        ? "border-border-accent/40"
                        : "border-border-subtle grayscale"
                    )}
                  />
                  <div className="absolute top-1 left-1">
                    <Checkbox
                      checked={row.selectedFields.has("image")}
                      onChange={() => onToggleField("image")}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Fields on right */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* Row 1: Title + Date */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {row.normalized.title && (
                  <ToggleableField field="title" label="Title" value={row.normalized.title} enabled={row.selectedFields.has("title")} onToggle={() => onToggleField("title")} />
                )}
                {row.normalized.date && (
                  <ToggleableField field="date" label="Date" value={row.normalized.date} enabled={row.selectedFields.has("date")} onToggle={() => onToggleField("date")} />
                )}
                {row.normalized.studioName && (
                  <ToggleableField field="studio" label="Studio" value={row.normalized.studioName} enabled={row.selectedFields.has("studio")} onToggle={() => onToggleField("studio")} />
                )}
                {row.normalized.url && (
                  <ToggleableField field="url" label="URL" value={row.normalized.url} enabled={row.selectedFields.has("url")} onToggle={() => onToggleField("url")} />
                )}
              </div>

              {/* Performers as removable chips */}
              {row.normalized.performerNames.length > 0 && (
                <div className={cn("transition-opacity", !row.selectedFields.has("performers") && "opacity-40")}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Checkbox
                      checked={row.selectedFields.has("performers")}
                      onChange={() => onToggleField("performers")}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-kicker">{entityTerms.performers}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {row.normalized.performerNames.map((name) => {
                      const excluded = row.excludedPerformers.has(name);
                      return (
                        <span
                          key={name}
                          className={cn(
                            "inline-flex items-center gap-1 tag-chip transition-all",
                            excluded
                              ? "tag-chip-default opacity-40 line-through"
                              : "tag-chip-accent"
                          )}
                        >
                          {name}
                          <button
                            onClick={(e) => { e.stopPropagation(); onTogglePerformer(name); }}
                            className="hover:text-status-error-text transition-colors"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tags as removable chips */}
              {row.normalized.tagNames.length > 0 && (
                <div className={cn("transition-opacity", !row.selectedFields.has("tags") && "opacity-40")}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Checkbox
                      checked={row.selectedFields.has("tags")}
                      onChange={() => onToggleField("tags")}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-kicker">Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {row.normalized.tagNames.map((name) => {
                      const excluded = row.excludedTags.has(name);
                      return (
                        <span
                          key={name}
                          className={cn(
                            "inline-flex items-center gap-1 tag-chip transition-all",
                            excluded
                              ? "tag-chip-default opacity-40 line-through"
                              : "tag-chip-default"
                          )}
                        >
                          {name}
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggleTag(name); }}
                            className="hover:text-status-error-text transition-colors"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      );
                    })}
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
